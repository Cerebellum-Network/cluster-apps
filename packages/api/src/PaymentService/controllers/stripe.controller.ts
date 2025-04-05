import { Request, Response } from 'express';
import StripeService from '../services/StripeService';
import logger, { logError } from '../utils/logger';

class StripeController {
  /**
   * Iniciar un nuevo pago a través de Stripe (Fiat)
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async createPaymentIntent(req: Request, res: Response): Promise<void> {
    try {
      const { amountUsd, stablecoinSymbol, cereNetworkAddress, ddcAccountId } = req.body;
      
      // Validar parámetros requeridos
      if (!amountUsd || !stablecoinSymbol || !cereNetworkAddress) {
        res.status(400).json({
          success: false,
          message: 'Se requieren amountUsd, stablecoinSymbol y cereNetworkAddress'
        });
        return;
      }
      
      // Validar monto
      const amount = parseFloat(amountUsd);
      if (isNaN(amount) || amount <= 0) {
        res.status(400).json({
          success: false,
          message: 'El monto debe ser un número positivo'
        });
        return;
      }
      
      // Obtener el ID del usuario de la solicitud autenticada
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
        return;
      }
      
      // Iniciar el pago con Stripe
      const paymentIntent = await StripeService.createPaymentIntent(
        userId,
        amount,
        stablecoinSymbol,
        cereNetworkAddress,
        ddcAccountId
      );
      
      // Devolver detalles para el cliente
      res.status(201).json({
        success: true,
        clientSecret: paymentIntent.clientSecret,
        paymentId: paymentIntent.paymentId,
        amount: paymentIntent.amount
      });
    } catch (error) {
      logError('Error en createPaymentIntent', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error al crear intención de pago'
      });
    }
  }

  /**
   * Procesar webhook de Stripe
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async webhook(req: Request, res: Response): Promise<void> {
    try {
      // Obtener los datos del webhook
      const signature = req.headers['stripe-signature'] as string;
      
      if (!signature) {
        res.status(400).json({
          success: false,
          message: 'Falta la firma de Stripe'
        });
        return;
      }
      
      // Procesar el webhook
      const result = await StripeService.handleWebhook(
        signature,
        req.body.toString()
      );
      
      // Responder
      res.status(200).json({
        success: true,
        received: result.received,
        eventType: result.type,
        eventId: result.id
      });
    } catch (error) {
      logError('Error en webhook de Stripe', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error al procesar webhook'
      });
    }
  }
}

export default new StripeController(); 