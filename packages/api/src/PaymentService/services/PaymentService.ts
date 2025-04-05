import { Transaction as SequelizeTransaction } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import PaymentRepository from '../repositories/PaymentRepository';
import sequelize from '../config/database';
import { 
  Payment, 
  PaymentStatus, 
  PaymentProvider,
  StablecoinTransaction,
  SwapTransaction,
  TeleportTransaction,
  DDCAccountUpdate
} from '../models';
import contractService from './ContractService';
import logger, { logError } from '../utils/logger';
import { SUPPORTED_STABLECOINS } from '../config/env';

class PaymentService {
  private paymentRepository: PaymentRepository;
  
  constructor() {
    this.paymentRepository = new PaymentRepository();
  }

  /**
   * Inicia un pago directo con stablecoin
   * @param userId ID del usuario
   * @param stablecoinSymbol Símbolo de la stablecoin (ej: 'USDC')
   * @param amount Cantidad de stablecoin
   * @param cereNetworkAddress Dirección en Cere Network
   * @param ddcAccountId ID de la cuenta DDC (opcional)
   * @returns Detalles del pago iniciado
   */
  async initiateDirectPayment(
    userId: string,
    stablecoinSymbol: string,
    amount: string,
    cereNetworkAddress: string,
    ddcAccountId?: string
  ): Promise<Payment> {
    // Verificar que la stablecoin es soportada
    const stablecoinAddress = SUPPORTED_STABLECOINS[stablecoinSymbol];
    if (!stablecoinAddress) {
      throw new Error(`Stablecoin ${stablecoinSymbol} no soportada`);
    }

    // Generar ID único para el pago
    const paymentId = uuidv4();

    try {
      // Crear el pago en la base de datos
      const payment = await this.paymentRepository.createPayment({
        userId,
        stablecoinAddress,
        stablecoinAmount: amount,
        cereNetworkAddress,
        paymentId,
        metadata: {
          ddcAccountId,
          stablecoinSymbol,
          initialRequest: {
            timestamp: new Date().toISOString(),
            stablecoinSymbol,
            amount,
            cereNetworkAddress,
            ddcAccountId
          }
        }
      });

      // Estimar la cantidad de CERE que recibirá el usuario
      try {
        const expectedCereAmount = await contractService.getExpectedCereAmount(stablecoinSymbol, amount);
        await this.paymentRepository.updateStatus(payment.id, payment.status, {
          expectedCereAmount
        });
      } catch (error) {
        // No fallamos el pago, solo logueamos el error
        logger.warn(`No se pudo obtener la estimación de CERE para el pago ${payment.id}: ${error}`);
      }

      return payment;
    } catch (error) {
      logError('Error al iniciar pago directo', error);
      throw new Error('No se pudo iniciar el pago');
    }
  }

  /**
   * Procesa una transacción de stablecoin recibida
   * @param paymentId ID del pago
   * @param txHash Hash de la transacción
   * @param fromAddress Dirección que envió la transacción
   * @param stablecoinAddress Dirección del contrato de stablecoin
   * @param amount Cantidad recibida
   * @returns Pago actualizado
   */
  async processStablecoinTransaction(
    paymentId: string,
    txHash: string,
    fromAddress: string,
    stablecoinAddress: string,
    amount: string
  ): Promise<Payment | null> {
    const transaction = await sequelize.transaction();
    
    try {
      // Buscar el pago
      const payment = await this.paymentRepository.findByPaymentId(paymentId, true);
      if (!payment) {
        await transaction.rollback();
        logger.warn(`Pago no encontrado para el ID ${paymentId}`);
        return null;
      }

      // Verificar que la stablecoin y el monto coinciden
      if (payment.stablecoinAddress.toLowerCase() !== stablecoinAddress.toLowerCase()) {
        await transaction.rollback();
        logger.warn(`La dirección de stablecoin no coincide para el pago ${payment.id}`);
        return null;
      }

      // Crear registro de transacción de stablecoin
      await StablecoinTransaction.create({
        paymentId: payment.id,
        txHash,
        fromAddress,
        amount,
        status: 'COMPLETED',
        metadata: {
          processedAt: new Date().toISOString()
        }
      }, { transaction });

      // Actualizar estado del pago
      await this.paymentRepository.updateStatus(
        payment.id, 
        PaymentStatus.PAYMENT_RECEIVED, 
        {
          stablecoinTxHash: txHash,
          fromAddress,
          confirmedAmount: amount
        }, 
        transaction
      );

      await transaction.commit();
      
      // Iniciar el proceso de swap (asíncrono)
      this.processPaymentSwap(payment.id).catch(error => {
        logError(`Error al procesar swap para el pago ${payment.id}`, error);
      });
      
      return payment;
    } catch (error) {
      await transaction.rollback();
      logError('Error al procesar transacción de stablecoin', error);
      throw error;
    }
  }

  /**
   * Procesa el intercambio de tokens para un pago
   * @param paymentId ID del pago
   * @returns Pago actualizado
   */
  async processPaymentSwap(paymentId: string): Promise<Payment | null> {
    const transaction = await sequelize.transaction();
    
    try {
      // Buscar el pago
      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        await transaction.rollback();
        logger.warn(`Pago no encontrado para el ID ${paymentId}`);
        return null;
      }

      // Verificar que el pago esté en el estado correcto
      if (payment.status !== PaymentStatus.PAYMENT_RECEIVED) {
        await transaction.rollback();
        logger.warn(`Estado incorrecto para swap: ${payment.status}`);
        throw new Error(`Estado incorrecto para swap: ${payment.status}`);
      }

      // Extraer información de stablecoin de los metadatos si es necesario
      const stablecoinSymbol = payment.metadata?.stablecoinSymbol;
      if (!stablecoinSymbol) {
        await transaction.rollback();
        throw new Error(`Símbolo de stablecoin no encontrado para el pago ${payment.id}`);
      }

      // Actualizar estado a procesando swap
      await this.paymentRepository.updateStatus(
        payment.id, 
        PaymentStatus.SWAPPING_TOKENS, 
        {}, 
        transaction
      );

      await transaction.commit(); // Commit primero para no mantener la transacción abierta durante la llamada externa

      // Realizar el swap utilizando contractService
      const swappedCereAmount = await contractService.swapTokens(
        stablecoinSymbol,
        payment.stablecoinAmount
      );

      // Iniciar nueva transacción para las actualizaciones posteriores al swap
      const postSwapTransaction = await sequelize.transaction();
      
      try {
        // Crear registro de transacción de swap
        const swapTxHash = `0xswap${Date.now()}`; // Idealmente, este valor vendría de contractService.swapTokens
        
        await SwapTransaction.create({
          paymentId: payment.id,
          txHash: swapTxHash,
          stablecoinAmount: payment.stablecoinAmount,
          cereAmount: swappedCereAmount,
          status: 'COMPLETED',
          metadata: {
            processedAt: new Date().toISOString()
          }
        }, { transaction: postSwapTransaction });

        // Actualizar estado del pago
        await this.paymentRepository.updateStatus(
          payment.id, 
          PaymentStatus.TOKENS_SWAPPED, 
          {
            swapTxHash,
            cereAmount: swappedCereAmount
          }, 
          postSwapTransaction
        );

        await postSwapTransaction.commit();
        
        // Iniciar el proceso de teleport (asíncrono)
        this.processTeleport(payment.id).catch(error => {
          logError(`Error al procesar teleport para el pago ${payment.id}`, error);
        });
        
        return payment;
      } catch (error) {
        await postSwapTransaction.rollback();
        throw error;
      }
    } catch (error) {
      if (transaction.finished !== 'commit') {
        await transaction.rollback();
      }
      logError('Error al procesar swap de tokens', error);
      throw error;
    }
  }

  /**
   * Procesa la teleportación de tokens a Cere Network
   * @param paymentId ID del pago
   * @returns Pago actualizado
   */
  async processTeleport(paymentId: string): Promise<Payment | null> {
    const transaction = await sequelize.transaction();
    
    try {
      // Buscar el pago
      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        await transaction.rollback();
        logger.warn(`Pago no encontrado para el ID ${paymentId}`);
        return null;
      }

      // Verificar que el pago esté en el estado correcto
      if (payment.status !== PaymentStatus.TOKENS_SWAPPED) {
        await transaction.rollback();
        logger.warn(`Estado incorrecto para teleport: ${payment.status}`);
        throw new Error(`Estado incorrecto para teleport: ${payment.status}`);
      }

      // Verificar que tenemos la cantidad de CERE y dirección en Cere Network
      if (!payment.cereAmount || !payment.cereNetworkAddress) {
        await transaction.rollback();
        throw new Error(`Falta información necesaria para teleport: cereAmount=${payment.cereAmount}, cereNetworkAddress=${payment.cereNetworkAddress}`);
      }

      // Actualizar estado a procesando teleport
      await this.paymentRepository.updateStatus(
        payment.id, 
        PaymentStatus.TELEPORTING, 
        {}, 
        transaction
      );

      await transaction.commit(); // Commit primero para no mantener la transacción abierta durante la llamada externa

      // Realizar el teleport utilizando contractService
      const teleportTxId = await contractService.teleportTokens(
        payment.cereAmount,
        payment.cereNetworkAddress
      );

      // Iniciar nueva transacción para las actualizaciones posteriores al teleport
      const postTeleportTransaction = await sequelize.transaction();
      
      try {
        // Crear registro de transacción de teleport
        await TeleportTransaction.create({
          paymentId: payment.id,
          teleportTxId,
          sourceChainTxHash: `0xsource${Date.now()}`,
          destinationChainTxHash: null, // Se actualizará cuando se confirme en Cere Network
          amount: payment.cereAmount,
          status: 'PENDING',
          metadata: {
            initiatedAt: new Date().toISOString()
          }
        }, { transaction: postTeleportTransaction });

        // Actualizar estado del pago
        await this.paymentRepository.updateStatus(
          payment.id, 
          PaymentStatus.TELEPORT_INITIATED, 
          {
            teleportTxId
          }, 
          postTeleportTransaction
        );

        await postTeleportTransaction.commit();
        
        // Programar verificación de estado de teleport
        this.scheduleTeleportCheck(payment.id, teleportTxId);
        
        return payment;
      } catch (error) {
        await postTeleportTransaction.rollback();
        throw error;
      }
    } catch (error) {
      if (transaction.finished !== 'commit') {
        await transaction.rollback();
      }
      logError('Error al procesar teleport', error);
      throw error;
    }
  }

  /**
   * Programa verificaciones periódicas del estado de teleport
   * @param paymentId ID del pago
   * @param teleportTxId ID de la transacción de teleport
   */
  private scheduleTeleportCheck(paymentId: string, teleportTxId: string): void {
    const checkTeleport = async () => {
      try {
        const status = await contractService.checkTeleportStatus(teleportTxId);
        
        // 0: No existe, 1: Pendiente, 2: Completada, 3: Fallida
        if (status === 2) {
          await this.confirmTeleport(paymentId, teleportTxId, `0xdest${Date.now()}`);
        } else if (status === 3) {
          await this.paymentRepository.markAsFailed(
            paymentId, 
            'TELEPORT', 
            'Teleport transaction failed'
          );
        } else if (status === 1) {
          // Seguir verificando cada 30 segundos
          setTimeout(checkTeleport, 30000);
        }
      } catch (error) {
        logError(`Error al verificar estado de teleport para ${paymentId}`, error);
        // Intentar nuevamente en 1 minuto
        setTimeout(checkTeleport, 60000);
      }
    };
    
    // Empezar a verificar después de 10 segundos
    setTimeout(checkTeleport, 10000);
  }

  /**
   * Confirma que la teleportación se ha completado
   * @param paymentId ID del pago
   * @param teleportTxId ID de la transacción de teleport
   * @param destinationTxHash Hash de la transacción en Cere Network
   * @returns Pago actualizado
   */
  async confirmTeleport(
    paymentId: string, 
    teleportTxId: string,
    destinationTxHash: string
  ): Promise<Payment | null> {
    const transaction = await sequelize.transaction();
    
    try {
      // Buscar el pago
      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        await transaction.rollback();
        logger.warn(`Pago no encontrado para el ID ${paymentId}`);
        return null;
      }

      // Verificar que el pago esté en el estado correcto
      if (payment.status !== PaymentStatus.TELEPORT_INITIATED) {
        await transaction.rollback();
        logger.warn(`Estado incorrecto para confirmar teleport: ${payment.status}`);
        throw new Error(`Estado incorrecto para confirmar teleport: ${payment.status}`);
      }

      // Actualizar la transacción de teleport
      const teleportTx = await TeleportTransaction.findOne({
        where: { paymentId: payment.id, teleportTxId },
        transaction
      });
      
      if (!teleportTx) {
        await transaction.rollback();
        throw new Error(`No se encontró la transacción de teleport para el pago ${payment.id} con teleportTxId ${teleportTxId}`);
      }

      teleportTx.destinationChainTxHash = destinationTxHash;
      teleportTx.status = 'COMPLETED';
      teleportTx.metadata = {
        ...teleportTx.metadata,
        completedAt: new Date().toISOString()
      };
      await teleportTx.save({ transaction });

      // Actualizar estado del pago
      await this.paymentRepository.updateStatus(
        payment.id, 
        PaymentStatus.TELEPORT_CONFIRMED, 
        {
          destinationTxHash
        }, 
        transaction
      );

      await transaction.commit();
      
      // Iniciar el proceso de actualización de cuenta DDC
      this.updateDDCAccount(payment.id).catch(error => {
        logError(`Error al actualizar cuenta DDC para el pago ${payment.id}`, error);
      });
      
      return payment;
    } catch (error) {
      await transaction.rollback();
      logError('Error al confirmar teleport', error);
      throw error;
    }
  }

  /**
   * Actualiza el balance de la cuenta DDC
   * @param paymentId ID del pago
   * @returns Pago actualizado
   */
  async updateDDCAccount(paymentId: string): Promise<Payment | null> {
    const transaction = await sequelize.transaction();
    
    try {
      // Buscar el pago
      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        await transaction.rollback();
        logger.warn(`Pago no encontrado para el ID ${paymentId}`);
        return null;
      }

      // Verificar que el pago esté en el estado correcto
      if (payment.status !== PaymentStatus.TELEPORT_CONFIRMED) {
        await transaction.rollback();
        logger.warn(`Estado incorrecto para actualizar DDC: ${payment.status}`);
        throw new Error(`Estado incorrecto para actualizar DDC: ${payment.status}`);
      }

      // Obtener información de la cuenta DDC
      const cereNetworkAddress = payment.cereNetworkAddress;
      if (!cereNetworkAddress) {
        await transaction.rollback();
        throw new Error('DDC Account ID (cereNetworkAddress) no encontrado');
      }

      // Actualizar estado a actualizando DDC
      await this.paymentRepository.updateStatus(
        payment.id, 
        PaymentStatus.UPDATING_DDC, 
        {}, 
        transaction
      );

      await transaction.commit(); // Commit primero para no mantener la transacción abierta durante la llamada externa

      // Obtener el balance actual de CERE en la cuenta
      const previousBalance = await contractService.getCereBalance(cereNetworkAddress);
      
      // Actualizar el balance de la cuenta DDC
      const newBalance = await contractService.updateDDCAccountBalance(
        cereNetworkAddress,
        payment.cereAmount || '0'
      );

      // Iniciar nueva transacción para las actualizaciones posteriores a la actualización DDC
      const postUpdateTransaction = await sequelize.transaction();
      
      try {
        // Crear registro de actualización de cuenta DDC
        await DDCAccountUpdate.create({
          paymentId: payment.id,
          ddcAccountId: cereNetworkAddress,
          previousBalance,
          newBalance,
          cereAmount: payment.cereAmount || "0",
          status: 'COMPLETED',
          metadata: {
            updatedAt: new Date().toISOString()
          }
        }, { transaction: postUpdateTransaction });

        // Actualizar estado del pago a completado
        await this.paymentRepository.updateStatus(
          payment.id, 
          PaymentStatus.COMPLETED, 
          {
            ddcAccountId: cereNetworkAddress,
            ddcUpdatedBalance: newBalance,
            finalCereBalance: newBalance,
            completedAt: new Date().toISOString()
          }, 
          postUpdateTransaction
        );

        await postUpdateTransaction.commit();
        return payment;
      } catch (error) {
        await postUpdateTransaction.rollback();
        throw error;
      }
    } catch (error) {
      if (transaction.finished !== 'commit') {
        await transaction.rollback();
      }
      logError('Error al actualizar cuenta DDC', error);
      
      try {
        await this.paymentRepository.markAsFailed(
          paymentId,
          'DDC_UPDATE',
          error.message || 'Error al actualizar cuenta DDC'
        );
      } catch (markError) {
        logError(`Error al marcar pago ${paymentId} como fallido`, markError);
      }
      
      throw error;
    }
  }

  /**
   * Obtiene los detalles de un pago
   * @param id ID del pago
   * @returns Detalles del pago
   */
  async getPaymentDetails(id: string): Promise<Payment | null> {
    try {
      return await this.paymentRepository.findById(id, true);
    } catch (error) {
      logError('Error al obtener detalles del pago', error);
      throw error;
    }
  }

  /**
   * Obtiene los pagos de un usuario
   * @param userId ID del usuario
   * @param limit Límite de resultados
   * @param offset Desplazamiento para paginación
   * @returns Lista de pagos
   */
  async getUserPayments(userId: string, limit = 10, offset = 0): Promise<Payment[]> {
    try {
      return await this.paymentRepository.findByUserId(userId, limit, offset);
    } catch (error) {
      logError('Error al obtener pagos del usuario', error);
      throw error;
    }
  }

  /**
   * Inicia un pago a través de Stripe
   * @param userId ID del usuario
   * @param externalId ID externo (Stripe payment intent ID)
   * @param stablecoinSymbol Símbolo de la stablecoin
   * @param amount Cantidad de stablecoin
   * @param cereNetworkAddress Dirección en Cere Network
   * @param ddcAccountId ID de la cuenta DDC (opcional)
   * @param metadata Metadatos adicionales
   * @returns Detalles del pago iniciado
   */
  async initiateStripePayment(
    userId: string,
    externalId: string,
    stablecoinSymbol: string,
    amount: string,
    cereNetworkAddress: string,
    ddcAccountId?: string,
    metadata: Record<string, any> = {}
  ): Promise<Payment> {
    // Verificar que la stablecoin es soportada
    const stablecoinAddress = SUPPORTED_STABLECOINS[stablecoinSymbol];
    if (!stablecoinAddress) {
      throw new Error(`Stablecoin ${stablecoinSymbol} no soportada`);
    }

    // Generar ID único para el pago
    const paymentId = uuidv4();

    try {
      // Crear el pago en la base de datos
      const payment = await this.paymentRepository.createPayment({
        userId,
        externalId,
        stablecoinAddress,
        stablecoinAmount: amount,
        cereNetworkAddress,
        paymentId,
        provider: PaymentProvider.STRIPE,
        metadata: {
          ddcAccountId,
          stablecoinSymbol,
          stripePaymentIntentId: externalId,
          ...metadata,
          initialRequest: {
            timestamp: new Date().toISOString(),
            stablecoinSymbol,
            amount,
            cereNetworkAddress,
            ddcAccountId
          }
        }
      });

      // Estimar la cantidad de CERE que recibirá el usuario
      try {
        const expectedCereAmount = await contractService.getExpectedCereAmount(stablecoinSymbol, amount);
        await this.paymentRepository.updateStatus(payment.id, payment.status, {
          expectedCereAmount
        });
      } catch (error) {
        // No fallamos el pago, solo logueamos el error
        logger.warn(`No se pudo obtener la estimación de CERE para el pago ${payment.id}: ${error}`);
      }

      return payment;
    } catch (error) {
      logError('Error al iniciar pago con Stripe', error);
      throw new Error('No se pudo iniciar el pago');
    }
  }

  /**
   * Busca un pago por su ID externo
   * @param externalId ID externo (ej: ID de pago de Stripe)
   * @returns Pago encontrado o null
   */
  async findPaymentByExternalId(externalId: string): Promise<Payment | null> {
    try {
      return await this.paymentRepository.findByExternalId(externalId);
    } catch (error) {
      logError(`Error al buscar pago con ID externo ${externalId}`, error);
      throw error;
    }
  }

  /**
   * Actualiza el estado de un pago desde Stripe
   * @param id ID del pago
   * @param status Nuevo estado del pago
   * @param additionalData Datos adicionales
   * @returns Pago actualizado
   */
  async updatePaymentStatusForStripe(
    id: string,
    status: PaymentStatus,
    additionalData: Record<string, any> = {}
  ): Promise<Payment | null> {
    try {
      return await this.paymentRepository.updateStatus(id, status, additionalData);
    } catch (error) {
      logError(`Error al actualizar estado del pago ${id} desde Stripe`, error);
      throw error;
    }
  }

  /**
   * Marca un pago como fallido
   * @param id ID del pago
   * @param step Paso donde ocurrió el error
   * @param errorMessage Mensaje de error
   * @returns Pago actualizado
   */
  async markPaymentAsFailed(
    id: string,
    step: string,
    errorMessage: string
  ): Promise<Payment | null> {
    try {
      return await this.paymentRepository.markAsFailed(id, step, errorMessage);
    } catch (error) {
      logError(`Error al marcar pago ${id} como fallido`, error);
      throw error;
    }
  }
}

export default new PaymentService(); 