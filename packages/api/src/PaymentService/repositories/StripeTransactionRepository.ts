/**
 * Repositorio para el manejo de transacciones de Stripe
 * Parte de la implementación de la subtarea #4.4 - Implement Transaction Record Mapping and Reconciliation
 */

import StripeTransaction, { 
  StripeTransactionDocument, 
  StripeTransactionStatus, 
  StripeTransactionType
} from '../models/StripeTransaction';
import logger from '../../utils/logger';

class StripeTransactionRepository {
  /**
   * Crear un nuevo registro de transacción
   */
  async create(data: {
    userId: string;
    paymentId: string;
    stripePaymentIntentId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    metadata?: Record<string, any>;
    description?: string;
  }): Promise<StripeTransactionDocument> {
    try {
      const transaction = new StripeTransaction({
        ...data,
        status: StripeTransactionStatus.CREATED,
        type: StripeTransactionType.PAYMENT,
        eventLog: [{
          timestamp: new Date(),
          eventType: 'TRANSACTION_CREATED',
          status: StripeTransactionStatus.CREATED,
          data: { ...data }
        }]
      });
      
      await transaction.save();
      logger.info(`Stripe transaction record created: ${transaction.id}`, {
        stripePaymentIntentId: data.stripePaymentIntentId
      });
      
      return transaction;
    } catch (error) {
      logger.error('Error creating stripe transaction record', error);
      throw error;
    }
  }

  /**
   * Buscar una transacción por ID
   */
  async findById(id: string): Promise<StripeTransactionDocument | null> {
    try {
      return await StripeTransaction.findById(id);
    } catch (error) {
      logger.error(`Error finding stripe transaction by ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * Buscar una transacción por ID de Payment Intent de Stripe
   */
  async findByPaymentIntentId(paymentIntentId: string): Promise<StripeTransactionDocument | null> {
    try {
      return await StripeTransaction.findOne({ stripePaymentIntentId: paymentIntentId });
    } catch (error) {
      logger.error(`Error finding stripe transaction by payment intent ID: ${paymentIntentId}`, error);
      throw error;
    }
  }

  /**
   * Buscar una transacción por ID de pago interno
   */
  async findByPaymentId(paymentId: string): Promise<StripeTransactionDocument | null> {
    try {
      return await StripeTransaction.findOne({ paymentId });
    } catch (error) {
      logger.error(`Error finding stripe transaction by payment ID: ${paymentId}`, error);
      throw error;
    }
  }

  /**
   * Buscar una transacción por ID de cargo de Stripe
   */
  async findByChargeId(chargeId: string): Promise<StripeTransactionDocument | null> {
    try {
      return await StripeTransaction.findOne({ stripeChargeId: chargeId });
    } catch (error) {
      logger.error(`Error finding stripe transaction by charge ID: ${chargeId}`, error);
      throw error;
    }
  }

  /**
   * Actualizar el estado de una transacción
   */
  async updateStatus(
    id: string,
    status: StripeTransactionStatus,
    eventType: string,
    eventData: Record<string, any> = {}
  ): Promise<StripeTransactionDocument | null> {
    try {
      const transaction = await StripeTransaction.findById(id);
      
      if (!transaction) {
        logger.warn(`No transaction found with ID: ${id}`);
        return null;
      }
      
      // Agregar evento al registro
      transaction.addEvent(eventType, status, eventData);
      
      // Actualizar estado
      transaction.status = status;
      
      // Guardar cambios
      await transaction.save();
      
      return transaction;
    } catch (error) {
      logger.error(`Error updating status for transaction: ${id}`, error);
      throw error;
    }
  }

  /**
   * Actualizar información de una transacción
   */
  async update(
    id: string,
    updates: {
      stripeChargeId?: string;
      stripeRefundId?: string;
      stripeDisputeId?: string;
      status?: StripeTransactionStatus;
      type?: StripeTransactionType;
      paymentMethodDetails?: Record<string, any>;
      receiptUrl?: string;
      metadata?: Record<string, any>;
    },
    eventType: string = 'TRANSACTION_UPDATED'
  ): Promise<StripeTransactionDocument | null> {
    try {
      const transaction = await StripeTransaction.findById(id);
      
      if (!transaction) {
        logger.warn(`No transaction found with ID: ${id}`);
        return null;
      }
      
      // Actualizar campos
      if (updates.stripeChargeId) transaction.stripeChargeId = updates.stripeChargeId;
      if (updates.stripeRefundId) transaction.stripeRefundId = updates.stripeRefundId;
      if (updates.stripeDisputeId) transaction.stripeDisputeId = updates.stripeDisputeId;
      if (updates.status) transaction.status = updates.status;
      if (updates.type) transaction.type = updates.type;
      if (updates.paymentMethodDetails) transaction.paymentMethodDetails = updates.paymentMethodDetails;
      if (updates.receiptUrl) transaction.receiptUrl = updates.receiptUrl;
      if (updates.metadata) {
        transaction.metadata = {
          ...transaction.metadata,
          ...updates.metadata
        };
      }
      
      // Agregar evento al registro
      transaction.addEvent(eventType, updates.status || transaction.status, {
        updates: { ...updates }
      });
      
      // Guardar cambios
      await transaction.save();
      
      return transaction;
    } catch (error) {
      logger.error(`Error updating transaction: ${id}`, error);
      throw error;
    }
  }

  /**
   * Buscar transacciones por estado
   */
  async findByStatus(
    status: StripeTransactionStatus,
    limit: number = 20,
    page: number = 1
  ): Promise<StripeTransactionDocument[]> {
    try {
      const skip = (page - 1) * limit;
      return await StripeTransaction.find({ status })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error) {
      logger.error(`Error finding transactions by status: ${status}`, error);
      throw error;
    }
  }

  /**
   * Buscar transacciones de un usuario
   */
  async findByUserId(
    userId: string,
    limit: number = 20,
    page: number = 1
  ): Promise<StripeTransactionDocument[]> {
    try {
      const skip = (page - 1) * limit;
      return await StripeTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error) {
      logger.error(`Error finding transactions for user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Contar transacciones por estado
   */
  async countByStatus(status: StripeTransactionStatus): Promise<number> {
    try {
      return await StripeTransaction.countDocuments({ status });
    } catch (error) {
      logger.error(`Error counting transactions by status: ${status}`, error);
      throw error;
    }
  }

  /**
   * Obtener transacciones en un rango de fechas
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 100,
    page: number = 1
  ): Promise<StripeTransactionDocument[]> {
    try {
      const skip = (page - 1) * limit;
      return await StripeTransaction.find({
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error) {
      logger.error(`Error finding transactions by date range`, error);
      throw error;
    }
  }
}

export default new StripeTransactionRepository(); 