import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import logger, { logError } from '../../utils/logger';
import PaymentService from './PaymentService';
import { PaymentStatus } from '../models';
import credentialService from './CredentialService';

/**
 * Servicio para interactuar con la API de Stripe
 * Implementa la subtarea #4.1 - Implement Stripe API Client and Payment Intent Creation
 * Actualizado para usar CredentialService como parte de la subtarea #4.2
 */
class StripeService {
  private stripe: Stripe | null = null;
  private isInitialized = false;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;
  
  constructor() {
    // Inicialización diferida - el cliente de Stripe se inicializará en el primer uso
  }

  /**
   * Inicializar el cliente de Stripe con credenciales seguras
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized && this.stripe) return true;
    
    try {
      // Obtener la clave secreta desde el servicio de credenciales
      const secretKey = await credentialService.getStripeSecretKey();
      
      if (!secretKey) {
        throw new Error('Stripe secret key not available');
      }
      
      // Inicializar el cliente de Stripe con la versión más reciente de la API
      this.stripe = new Stripe(secretKey, {
        // Usamos la API version estable más reciente
        apiVersion: '2022-11-15', 
        maxNetworkRetries: 2, // Configurar reintentos automáticos para solicitudes de red
        timeout: 30000 // Timeout de 30 segundos para las solicitudes
      });
      
      this.isInitialized = true;
      logger.info('Stripe client initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Stripe client', error);
      return false;
    }
  }

  /**
   * Obtener la instancia del cliente de Stripe, inicializándola si es necesario
   */
  private async getStripeClient(): Promise<Stripe> {
    if (!this.isInitialized || !this.stripe) {
      const initialized = await this.initialize();
      
      if (!initialized || !this.stripe) {
        throw new Error('Failed to initialize Stripe client');
      }
    }
    
    return this.stripe;
  }

  /**
   * Crea una intención de pago (payment intent) en Stripe
   * @param userId ID del usuario
   * @param amountUsd Cantidad en USD
   * @param stablecoinSymbol Símbolo de la stablecoin a recibir
   * @param cereNetworkAddress Dirección en Cere Network
   * @param ddcAccountId ID de la cuenta DDC (opcional)
   * @param paymentMethods Métodos de pago a habilitar (opcional)
   * @returns Detalles para iniciar el pago en Stripe
   */
  async createPaymentIntent(
    userId: string,
    amountUsd: number,
    stablecoinSymbol: string,
    cereNetworkAddress: string,
    ddcAccountId?: string,
    paymentMethods: string[] = ['card']
  ): Promise<{
    clientSecret: string;
    paymentId: string;
    amount: number;
    paymentMethods: string[];
  }> {
    try {
      // Validaciones adicionales
      if (!userId) throw new Error('User ID is required');
      if (amountUsd <= 0) throw new Error('Amount must be greater than 0');
      if (!['USDC', 'USDT'].includes(stablecoinSymbol)) {
        throw new Error('Invalid stablecoin symbol. Must be USDC or USDT');
      }
      if (!cereNetworkAddress.match(/^(cere|CERE)[a-zA-Z0-9]{38}$/)) {
        throw new Error('Invalid Cere Network address format');
      }
      
      // Verificar credenciales de Stripe antes de operar
      const verificationResult = await credentialService.verifyStripeCredentials();
      
      if (!verificationResult.isValid) {
        throw new Error(`Missing Stripe credentials: ${verificationResult.missing.join(', ')}`);
      }
      
      // Generar ID único para el pago
      const paymentId = uuidv4();
      
      // Crear payment intent en Stripe con soporte para múltiples métodos de pago
      const paymentIntent = await this.createStripePaymentIntent(
        paymentId,
        userId,
        amountUsd,
        stablecoinSymbol,
        cereNetworkAddress,
        ddcAccountId,
        paymentMethods
      );
      
      // Crear el registro de pago en nuestra base de datos
      // Calculamos la cantidad equivalente de stablecoin (asumimos 1:1 para USD-USDC/USDT)
      const stablecoinAmount = amountUsd.toString();
      
      // Iniciar registro de pago
      await PaymentService.initiateStripePayment(
        userId,
        paymentIntent.id,
        stablecoinSymbol,
        stablecoinAmount,
        cereNetworkAddress,
        ddcAccountId,
        {
          stripePaymentIntentId: paymentIntent.id,
          amountUsd,
          paymentMethods: paymentIntent.payment_method_types
        }
      );
      
      return {
        clientSecret: paymentIntent.client_secret || '',
        paymentId: paymentId,
        amount: amountUsd,
        paymentMethods: paymentIntent.payment_method_types
      };
    } catch (error) {
      logError('Error creating Stripe payment intent', error);
      
      // Mejorar el reporte de errores
      if (error instanceof Stripe.errors.StripeError) {
        switch (error.type) {
          case 'StripeCardError':
            throw new Error(`Card error: ${error.message}`);
          case 'StripeRateLimitError':
            throw new Error('Rate limit exceeded. Please try again later');
          case 'StripeInvalidRequestError':
            throw new Error(`Invalid request: ${error.message}`);
          case 'StripeAPIError':
            throw new Error('Stripe API error. Please try again later');
          case 'StripeConnectionError':
            throw new Error('Could not connect to Stripe. Please try again later');
          case 'StripeAuthenticationError':
            logger.error('Stripe authentication error', error);
            throw new Error('Payment service configuration error');
          default:
            throw new Error(`Payment error: ${error.message}`);
        }
      }
      
      throw new Error('Failed to create payment intent');
    }
  }

  /**
   * Crear una intención de pago en Stripe con reintentos
   * @param paymentId ID interno del pago
   * @param userId ID del usuario
   * @param amountUsd Cantidad en USD
   * @param stablecoinSymbol Símbolo de la stablecoin
   * @param cereNetworkAddress Dirección Cere
   * @param ddcAccountId ID de cuenta DDC
   * @param paymentMethods Métodos de pago habilitados
   * @returns Payment Intent de Stripe
   */
  private async createStripePaymentIntent(
    paymentId: string,
    userId: string,
    amountUsd: number,
    stablecoinSymbol: string,
    cereNetworkAddress: string,
    ddcAccountId?: string,
    paymentMethods: string[] = ['card']
  ): Promise<Stripe.PaymentIntent> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        // Obtener cliente de Stripe
        const stripe = await this.getStripeClient();
        
        // Configurar la información del payment intent
        const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
          amount: Math.round(amountUsd * 100), // Convertir a centavos
          currency: 'usd',
          payment_method_types: paymentMethods,
          metadata: {
            userId,
            paymentId,
            stablecoinSymbol,
            cereNetworkAddress,
            ddcAccountId: ddcAccountId || '',
            source: 'cere-developer-console'
          },
          // Propiedades adicionales para mejorar la experiencia de usuario
          capture_method: 'automatic',
          confirm: false,
          statement_descriptor: 'CERE DDC TOPUP',
          statement_descriptor_suffix: 'CERETOPUP',
          description: `CERE DDC Topup - ${stablecoinSymbol} ${amountUsd}`,
        };
        
        // Crear el payment intent
        return await stripe.paymentIntents.create(paymentIntentParams);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Si es un error que no debería reintentar, propagar inmediatamente
        if (error instanceof Stripe.errors.StripeError && 
           ['StripeAuthenticationError', 'StripeInvalidRequestError'].includes(error.type)) {
          throw error;
        }
        
        // Esperar antes de reintentar (con backoff exponencial)
        const delayMs = this.RETRY_DELAY_MS * Math.pow(2, attempt);
        logger.warn(`Retrying createStripePaymentIntent after ${delayMs}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // Si llegamos aquí, todos los reintentos fallaron
    throw lastError || new Error('Failed to create Stripe payment intent after multiple retries');
  }

  /**
   * Verifica el estado de un pago en Stripe
   * @param paymentIntentId ID de payment intent de Stripe
   * @returns Estado del pago
   */
  async checkPaymentStatus(paymentIntentId: string): Promise<{
    status: string;
    amount: number;
    paymentMethod?: string;
    receiptUrl?: string;
  }> {
    try {
      const stripe = await this.getStripeClient();
      
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        { expand: ['latest_charge'] }
      );
      
      const latestCharge = paymentIntent.latest_charge as Stripe.Charge;
      
      return {
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100, // Convertir de centavos a dólares
        paymentMethod: paymentIntent.payment_method_types[0],
        receiptUrl: latestCharge?.receipt_url
      };
    } catch (error) {
      logError(`Error checking payment status for ${paymentIntentId}`, error);
      throw new Error('Could not retrieve payment status');
    }
  }

  /**
   * Procesa un webhook de Stripe
   * @param signature Firma de Stripe
   * @param rawBody Cuerpo raw del webhook
   * @returns Resultado del procesamiento
   */
  async handleWebhook(signature: string, rawBody: string): Promise<{
    received: boolean;
    type: string;
    id: string;
  }> {
    try {
      // Obtener secreto de webhook desde el servicio de credenciales
      const webhookSecret = await credentialService.getStripeWebhookSecret();
      
      if (!webhookSecret) {
        throw new Error('Stripe webhook secret not configured');
      }
      
      const stripe = await this.getStripeClient();
      
      // Verificar la firma del webhook
      const event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );
      
      logger.info(`Processing Stripe webhook: ${event.type}`, { eventId: event.id });
      
      // Manejar diferentes tipos de eventos
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.canceled':
          await this.handlePaymentCancellation(event.data.object as Stripe.PaymentIntent);
          break;
        case 'charge.refunded':
          await this.handleRefund(event.data.object as Stripe.Charge);
          break;
        default:
          logger.info(`Unhandled Stripe event type: ${event.type}`);
          break;
      }
      
      return {
        received: true,
        type: event.type,
        id: event.id
      };
    } catch (error) {
      logError('Error processing Stripe webhook', error);
      throw new Error(`Webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Maneja un pago exitoso
   * @param paymentIntent Objeto PaymentIntent de Stripe
   */
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const { userId, paymentId, stablecoinSymbol, cereNetworkAddress, ddcAccountId } = paymentIntent.metadata;
      
      if (!userId || !paymentId || !stablecoinSymbol || !cereNetworkAddress) {
        logger.warn('Missing required metadata in Stripe payment intent', paymentIntent.metadata);
        return;
      }
      
      // Buscar el pago por el ID externo (Stripe payment intent ID)
      const payment = await PaymentService.findPaymentByExternalId(paymentIntent.id);
      
      if (!payment) {
        logger.warn(`Payment with Stripe ID ${paymentIntent.id} not found`);
        return;
      }
      
      // Si el pago ya fue procesado (no está en estado PENDIENTE), evitar duplicados
      if (payment.status !== 'PENDING') {
        logger.info(`Payment ${payment.id} already processed. Current status: ${payment.status}`);
        return;
      }
      
      // Actualizar estado del pago a PAYMENT_RECEIVED
      await PaymentService.updatePaymentStatusForStripe(
        payment.id,
        PaymentStatus.PAYMENT_RECEIVED,
        {
          stripeChargeId: paymentIntent.latest_charge as string,
          paymentMethod: paymentIntent.payment_method_types[0],
          transactionDetails: {
            amount: paymentIntent.amount / 100, // Convertir centavos a dólares
            currency: paymentIntent.currency,
            paymentMethod: paymentIntent.payment_method as string,
            paymentMethodType: paymentIntent.payment_method_types[0],
            receiptUrl: this.getReceiptUrl(paymentIntent)
          }
        }
      );
      
      // Iniciar proceso de swap (asíncrono)
      logger.info(`Starting swap process for payment ${payment.id}`);
      PaymentService.processPaymentSwap(payment.id).catch(error => {
        logError(`Error al procesar swap para el pago ${payment.id}`, error);
      });
    } catch (error) {
      logError('Error handling successful Stripe payment', error);
    }
  }

  /**
   * Obtiene la URL del recibo si está disponible
   * @param paymentIntent Objeto PaymentIntent de Stripe
   * @returns URL del recibo o undefined
   */
  private getReceiptUrl(paymentIntent: Stripe.PaymentIntent): string | undefined {
    if (!paymentIntent.latest_charge) return undefined;
    
    try {
      // Si latest_charge es un string, necesitamos obtener el objeto Charge
      if (typeof paymentIntent.latest_charge === 'string') {
        return undefined; // No tenemos el objeto Charge expandido
      }
      
      // Si latest_charge es un objeto Charge, podemos acceder a receipt_url
      return (paymentIntent.latest_charge as Stripe.Charge).receipt_url;
    } catch (error) {
      logError('Error getting receipt URL', error);
      return undefined;
    }
  }

  /**
   * Maneja un pago fallido
   * @param paymentIntent Objeto PaymentIntent de Stripe
   */
  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      // Buscar el pago por el ID externo (Stripe payment intent ID)
      const payment = await PaymentService.findPaymentByExternalId(paymentIntent.id);
      
      if (!payment) {
        logger.warn(`Payment with Stripe ID ${paymentIntent.id} not found`);
        return;
      }
      
      // Obtener información detallada del error
      const errorMessage = this.getDetailedErrorMessage(paymentIntent);
      
      // Marcar el pago como fallido
      await PaymentService.markPaymentAsFailed(
        payment.id,
        'STRIPE_PAYMENT',
        errorMessage
      );
    } catch (error) {
      logError('Error handling failed Stripe payment', error);
    }
  }

  /**
   * Maneja una cancelación de pago
   * @param paymentIntent Objeto PaymentIntent de Stripe
   */
  private async handlePaymentCancellation(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      // Buscar el pago por el ID externo (Stripe payment intent ID)
      const payment = await PaymentService.findPaymentByExternalId(paymentIntent.id);
      
      if (!payment) {
        logger.warn(`Payment with Stripe ID ${paymentIntent.id} not found`);
        return;
      }
      
      // Marcar el pago como cancelado
      await PaymentService.markPaymentAsFailed(
        payment.id,
        'STRIPE_PAYMENT_CANCELED',
        'Payment was canceled'
      );
    } catch (error) {
      logError('Error handling canceled Stripe payment', error);
    }
  }

  /**
   * Maneja un reembolso
   * @param charge Objeto Charge de Stripe
   */
  private async handleRefund(charge: Stripe.Charge): Promise<void> {
    try {
      // Buscar payment intent asociado a este cargo
      const paymentIntentId = charge.payment_intent as string;
      
      if (!paymentIntentId) {
        logger.warn('Charge does not have a payment_intent ID', { chargeId: charge.id });
        return;
      }
      
      // Buscar el pago por el ID externo (Stripe payment intent ID)
      const payment = await PaymentService.findPaymentByExternalId(paymentIntentId);
      
      if (!payment) {
        logger.warn(`Payment with Stripe ID ${paymentIntentId} not found`);
        return;
      }
      
      // Marcar como reembolsado si se reembolsó completamente
      if (charge.refunded) {
        // Usar markPaymentAsFailed con el mensaje de reembolso
        await PaymentService.markPaymentAsFailed(
          payment.id,
          'PAYMENT_REFUNDED',
          `Payment refunded ${charge.amount_refunded / 100} USD`
        );
        
        // Registrar evento de reembolso en logs
        logger.info(`Payment ${payment.id} refunded: ${charge.amount_refunded / 100} USD`, {
          chargeId: charge.id,
          refundAmount: charge.amount_refunded / 100
        });
      } else if (charge.amount_refunded > 0) {
        // Registrar reembolso parcial en los logs
        logger.info(`Partial refund for payment ${payment.id}: ${charge.amount_refunded / 100} USD`, {
          chargeId: charge.id,
          refundAmount: charge.amount_refunded / 100
        });
      }
    } catch (error) {
      logError('Error handling Stripe refund', error);
    }
  }

  /**
   * Obtiene un mensaje de error detallado de un PaymentIntent fallido
   * @param paymentIntent Objeto PaymentIntent de Stripe
   * @returns Mensaje de error detallado
   */
  private getDetailedErrorMessage(paymentIntent: Stripe.PaymentIntent): string {
    if (!paymentIntent.last_payment_error) {
      return 'Payment failed with no detailed error information';
    }
    
    const { code, message, type } = paymentIntent.last_payment_error;
    
    // Construir un mensaje de error más amigable y detallado
    let userMessage = message || 'Payment failed';
    
    // Añadir mensajes más específicos basados en el código de error
    if (code) {
      switch (code) {
        case 'card_declined':
          userMessage = 'Your card was declined. Please try a different payment method.';
          break;
        case 'expired_card':
          userMessage = 'Your card has expired. Please try a different card.';
          break;
        case 'incorrect_cvc':
          userMessage = 'The security code (CVC) is incorrect. Please check and try again.';
          break;
        case 'processing_error':
          userMessage = 'An error occurred while processing your card. Please try again later.';
          break;
        case 'insufficient_funds':
          userMessage = 'Your card has insufficient funds. Please try a different payment method.';
          break;
        default:
          userMessage = `Payment error: ${message} (code: ${code})`;
      }
    }
    
    return userMessage;
  }
}

export default new StripeService(); 