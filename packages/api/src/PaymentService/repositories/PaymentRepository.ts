import { Transaction } from 'sequelize';
import { 
  Payment, 
  PaymentStatus, 
  PaymentProvider, 
  StablecoinTransaction,
  SwapTransaction,
  TeleportTransaction,
  DDCAccountUpdate
} from '../models';
import logger, { logError } from '../utils/logger';

class PaymentRepository {
  /**
   * Create a new payment
   * @param data Payment data
   * @param transaction Optional Sequelize transaction
   * @returns Created payment
   */
  async createPayment(data: {
    userId: string;
    externalId?: string;
    stablecoinAddress: string;
    stablecoinAmount: string;
    cereNetworkAddress: string;
    paymentId: string;
    provider?: PaymentProvider;
    metadata?: Record<string, any>;
  }, transaction?: Transaction): Promise<Payment> {
    try {
      return await Payment.create({
        ...data,
        status: PaymentStatus.INITIATED,
        provider: data.provider || PaymentProvider.DIRECT
      }, { transaction });
    } catch (error) {
      logError('Failed to create payment', error);
      throw new Error('Database error: Failed to create payment');
    }
  }

  /**
   * Find a payment by ID
   * @param id Payment ID
   * @param includeTransactions Whether to include associated transactions
   * @returns Payment or null if not found
   */
  async findById(id: string, includeTransactions = false): Promise<Payment | null> {
    try {
      const include = includeTransactions ? [
        { model: StablecoinTransaction, as: 'stablecoinTransactions' },
        { model: SwapTransaction, as: 'swapTransactions' },
        { model: TeleportTransaction, as: 'teleportTransactions' },
        { model: DDCAccountUpdate, as: 'ddcAccountUpdates' }
      ] : [];

      return await Payment.findByPk(id, { include });
    } catch (error) {
      logError(`Failed to find payment with ID ${id}`, error);
      throw new Error('Database error: Failed to find payment');
    }
  }

  /**
   * Find a payment by payment ID (blockchain transaction ID)
   * @param paymentId Blockchain payment ID
   * @param includeTransactions Whether to include associated transactions
   * @returns Payment or null if not found
   */
  async findByPaymentId(paymentId: string, includeTransactions = false): Promise<Payment | null> {
    try {
      const include = includeTransactions ? [
        { model: StablecoinTransaction, as: 'stablecoinTransactions' },
        { model: SwapTransaction, as: 'swapTransactions' },
        { model: TeleportTransaction, as: 'teleportTransactions' },
        { model: DDCAccountUpdate, as: 'ddcAccountUpdates' }
      ] : [];

      return await Payment.findOne({ 
        where: { paymentId },
        include
      });
    } catch (error) {
      logError(`Failed to find payment with payment ID ${paymentId}`, error);
      throw new Error('Database error: Failed to find payment');
    }
  }

  /**
   * Find a payment by external ID (e.g., Stripe payment ID)
   * @param externalId External payment ID
   * @returns Payment or null if not found
   */
  async findByExternalId(externalId: string): Promise<Payment | null> {
    try {
      return await Payment.findOne({ where: { externalId } });
    } catch (error) {
      logError(`Failed to find payment with external ID ${externalId}`, error);
      throw new Error('Database error: Failed to find payment');
    }
  }

  /**
   * Get all payments for a user
   * @param userId User ID
   * @param limit Maximum number of payments to return
   * @param offset Offset for pagination
   * @returns Array of payments
   */
  async findByUserId(userId: string, limit = 10, offset = 0): Promise<Payment[]> {
    try {
      return await Payment.findAll({
        where: { userId },
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });
    } catch (error) {
      logError(`Failed to find payments for user ${userId}`, error);
      throw new Error('Database error: Failed to find payments');
    }
  }

  /**
   * Update payment status and related data
   * @param id Payment ID
   * @param status New payment status
   * @param additionalData Additional data to update
   * @param transaction Optional Sequelize transaction
   * @returns Updated payment
   */
  async updateStatus(
    id: string, 
    status: PaymentStatus, 
    additionalData: Record<string, any> = {}, 
    transaction?: Transaction
  ): Promise<Payment | null> {
    try {
      const payment = await Payment.findByPk(id, { transaction });
      
      if (!payment) {
        logger.warn(`Cannot update status: Payment with ID ${id} not found`);
        return null;
      }
      
      payment.updateStatus(status, additionalData);
      await payment.save({ transaction });
      
      return payment;
    } catch (error) {
      logError(`Failed to update payment status for ID ${id}`, error);
      throw new Error('Database error: Failed to update payment status');
    }
  }

  /**
   * Mark a payment as failed
   * @param id Payment ID
   * @param step Step where the failure occurred
   * @param errorMessage Error message
   * @param transaction Optional Sequelize transaction
   * @returns Updated payment
   */
  async markAsFailed(
    id: string, 
    step: string, 
    errorMessage: string, 
    transaction?: Transaction
  ): Promise<Payment | null> {
    try {
      const payment = await Payment.findByPk(id, { transaction });
      
      if (!payment) {
        logger.warn(`Cannot mark as failed: Payment with ID ${id} not found`);
        return null;
      }
      
      payment.markAsFailed(step, errorMessage);
      await payment.save({ transaction });
      
      return payment;
    } catch (error) {
      logError(`Failed to mark payment as failed for ID ${id}`, error);
      throw new Error('Database error: Failed to mark payment as failed');
    }
  }

  /**
   * Get payments with a specific status
   * @param status Payment status
   * @param limit Maximum number of payments to return
   * @param offset Offset for pagination
   * @returns Array of payments
   */
  async findByStatus(status: PaymentStatus, limit = 10, offset = 0): Promise<Payment[]> {
    try {
      return await Payment.findAll({
        where: { status },
        limit,
        offset,
        order: [['createdAt', 'ASC']]
      });
    } catch (error) {
      logError(`Failed to find payments with status ${status}`, error);
      throw new Error('Database error: Failed to find payments');
    }
  }

  /**
   * Get payments that need processing (all non-terminal states)
   * @param limit Maximum number of payments to return
   * @returns Array of payments needing processing
   */
  async findPendingPayments(limit = 10): Promise<Payment[]> {
    try {
      const terminalStates = [PaymentStatus.COMPLETED, PaymentStatus.FAILED];
      
      return await Payment.findAll({
        where: {
          status: {
            [Symbol.for('Sequelize.Op.notIn')]: terminalStates
          }
        },
        limit,
        order: [['createdAt', 'ASC']]
      });
    } catch (error) {
      logError('Failed to find pending payments', error);
      throw new Error('Database error: Failed to find pending payments');
    }
  }

  /**
   * Delete a payment (for testing/admin purposes only)
   * @param id Payment ID
   * @returns True if deleted, false if not found
   */
  async deletePayment(id: string): Promise<boolean> {
    try {
      const payment = await Payment.findByPk(id);
      
      if (!payment) {
        return false;
      }
      
      await payment.destroy();
      return true;
    } catch (error) {
      logError(`Failed to delete payment with ID ${id}`, error);
      throw new Error('Database error: Failed to delete payment');
    }
  }
}

// Export as singleton
export default new PaymentRepository(); 