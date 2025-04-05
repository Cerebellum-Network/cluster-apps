/**
 * Servicio para reconciliación y mapeo de transacciones de Stripe
 * Parte de la implementación de la subtarea #4.4 - Implement Transaction Record Mapping and Reconciliation
 */

import Stripe from 'stripe';
import logger from '../../utils/logger';
import StripeTransactionRepository from '../repositories/StripeTransactionRepository';
import PaymentService from './PaymentService';
import StripeService from './StripeService';
import { StripeTransactionStatus, StripeTransactionType } from '../models/StripeTransaction';

class StripeReconciliationService {
  /**
   * Crear un registro de transacción de Stripe 
   * basado en un Payment Intent
   */
  async createTransactionFromPaymentIntent(
    paymentIntent: Stripe.PaymentIntent,
    paymentId: string
  ) {
    try {
      // Verificar si ya existe una transacción para este payment intent
      const existingTransaction = await StripeTransactionRepository.findByPaymentIntentId(
        paymentIntent.id
      );
      
      if (existingTransaction) {
        logger.info(`Transaction already exists for Stripe Payment Intent ${paymentIntent.id}`);
        return existingTransaction;
      }
      
      // Extraer la información necesaria del payment intent
      const { metadata } = paymentIntent;
      const userId = metadata.userId;
      
      if (!userId) {
        throw new Error('Payment intent missing required userId in metadata');
      }
      
      // Crear el registro de transacción
      const transaction = await StripeTransactionRepository.create({
        userId,
        paymentId,
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Convertir centavos a dólares
        currency: paymentIntent.currency,
        paymentMethod: paymentIntent.payment_method_types[0] || 'unknown',
        metadata: metadata,
        description: paymentIntent.description
      });
      
      logger.info(`Created transaction mapping for Stripe Payment Intent ${paymentIntent.id}`, {
        transactionId: transaction.id,
        paymentId: paymentId
      });
      
      return transaction;
    } catch (error) {
      logger.error(`Error creating transaction from payment intent ${paymentIntent.id}`, error);
      throw error;
    }
  }

  /**
   * Actualizar un registro de transacción con información
   * de un cargo (charge) de Stripe
   */
  async updateTransactionWithCharge(charge: Stripe.Charge) {
    try {
      // Obtener el payment intent ID del cargo
      const paymentIntentId = charge.payment_intent as string;
      
      if (!paymentIntentId) {
        logger.warn('Charge does not have payment_intent ID', { chargeId: charge.id });
        return null;
      }
      
      // Buscar la transacción asociada
      const transaction = await StripeTransactionRepository.findByPaymentIntentId(paymentIntentId);
      
      if (!transaction) {
        logger.warn(`No transaction found for payment intent ${paymentIntentId}`);
        return null;
      }
      
      // Actualizar la transacción con los detalles del cargo
      const updatedTransaction = await StripeTransactionRepository.update(
        transaction.id,
        {
          stripeChargeId: charge.id,
          status: charge.status === 'succeeded' 
            ? StripeTransactionStatus.SUCCEEDED 
            : charge.status === 'failed'
              ? StripeTransactionStatus.FAILED
              : StripeTransactionStatus.PENDING,
          paymentMethodDetails: charge.payment_method_details,
          receiptUrl: charge.receipt_url || undefined,
          metadata: {
            chargeCreated: charge.created,
            chargeStatus: charge.status,
            paymentMethodType: charge.payment_method_type,
            ...charge.metadata
          }
        },
        'CHARGE_PROCESSED'
      );
      
      logger.info(`Updated transaction ${transaction.id} with charge information`, {
        chargeId: charge.id,
        status: charge.status
      });
      
      return updatedTransaction;
    } catch (error) {
      logger.error(`Error updating transaction with charge information`, error);
      throw error;
    }
  }

  /**
   * Actualizar un registro de transacción con información
   * de un reembolso (refund) de Stripe
   */
  async updateTransactionWithRefund(refund: Stripe.Refund) {
    try {
      // Obtener el ID del cargo asociado al reembolso
      const chargeId = refund.charge as string;
      
      if (!chargeId) {
        logger.warn('Refund does not have charge ID', { refundId: refund.id });
        return null;
      }
      
      // Buscar la transacción por el ID de cargo
      const transaction = await StripeTransactionRepository.findByChargeId(chargeId);
      
      if (!transaction) {
        logger.warn(`No transaction found for charge ${chargeId}`);
        return null;
      }
      
      // Determinar si es un reembolso completo o parcial
      const isFullRefund = refund.amount === refund.charge_amount;
      const status = isFullRefund 
        ? StripeTransactionStatus.REFUNDED 
        : StripeTransactionStatus.PARTIALLY_REFUNDED;
      
      // Actualizar la transacción con la información del reembolso
      const updatedTransaction = await StripeTransactionRepository.update(
        transaction.id,
        {
          stripeRefundId: refund.id,
          status,
          type: StripeTransactionType.REFUND,
          metadata: {
            refundAmount: refund.amount / 100, // Convertir a dólares
            refundReason: refund.reason,
            refundStatus: refund.status,
            isFullRefund,
            ...refund.metadata
          }
        },
        'REFUND_PROCESSED'
      );
      
      logger.info(`Updated transaction ${transaction.id} with refund information`, {
        refundId: refund.id,
        isFullRefund,
        amount: refund.amount / 100
      });
      
      return updatedTransaction;
    } catch (error) {
      logger.error(`Error updating transaction with refund information`, error);
      throw error;
    }
  }

  /**
   * Sincronizar transacciones con Stripe
   * Este método se puede ejecutar periódicamente para asegurarse
   * de que los registros estén actualizados
   */
  async syncTransactions(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<{ updated: number, created: number, failed: number }> {
    try {
      logger.info(`Starting transaction sync from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      const stripe = await StripeService.getStripeClient();
      
      // Convertir fechas a timestamps de Unix (segundos)
      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);
      
      // Obtener payment intents creados en el periodo
      const paymentIntents = await stripe.paymentIntents.list({
        limit: 100,
        created: {
          gte: startTimestamp,
          lte: endTimestamp
        }
      });
      
      logger.info(`Found ${paymentIntents.data.length} payment intents to sync`);
      
      let updated = 0;
      let created = 0;
      let failed = 0;
      
      // Procesar cada payment intent
      for (const paymentIntent of paymentIntents.data) {
        try {
          // Verificar si el payment intent ya tiene una transacción
          const existingTransaction = await StripeTransactionRepository.findByPaymentIntentId(
            paymentIntent.id
          );
          
          if (existingTransaction) {
            // Actualizar la transacción existente con información más reciente
            await StripeTransactionRepository.update(
              existingTransaction.id,
              {
                status: this.mapStripeStatusToTransactionStatus(paymentIntent.status),
                metadata: {
                  ...existingTransaction.metadata,
                  lastSyncedAt: new Date().toISOString(),
                  currentStatus: paymentIntent.status
                }
              },
              'SYNC_UPDATED'
            );
            
            updated++;
          } else {
            // Buscar el pago asociado con este payment intent
            const payment = await PaymentService.findPaymentByExternalId(paymentIntent.id);
            
            if (payment) {
              // Crear un registro de transacción
              await this.createTransactionFromPaymentIntent(paymentIntent, payment.id);
              created++;
            } else {
              logger.warn(`No payment record found for Stripe Payment Intent ${paymentIntent.id}`);
              failed++;
            }
          }
        } catch (error) {
          logger.error(`Error processing payment intent ${paymentIntent.id} during sync`, error);
          failed++;
        }
      }
      
      logger.info(`Sync completed: ${created} created, ${updated} updated, ${failed} failed`);
      
      return { updated, created, failed };
    } catch (error) {
      logger.error('Error syncing transactions with Stripe', error);
      throw error;
    }
  }

  /**
   * Buscar transacciones que requieren reconciliación
   * (transacciones que tienen discrepancias entre Stripe y nuestros registros)
   */
  async findTransactionsNeedingReconciliation(
    limit: number = 50
  ): Promise<{ transactionId: string; paymentId: string; discrepancies: string[] }[]> {
    try {
      // Obtener transacciones exitosas en Stripe
      const successfulTransactions = await StripeTransactionRepository.findByStatus(
        StripeTransactionStatus.SUCCEEDED,
        limit
      );
      
      const results: { transactionId: string; paymentId: string; discrepancies: string[] }[] = [];
      
      // Analizar cada transacción
      for (const transaction of successfulTransactions) {
        const discrepancies: string[] = [];
        
        // Verificar si el pago existe en nuestro sistema
        const payment = await PaymentService.findById(transaction.paymentId);
        
        if (!payment) {
          discrepancies.push('PAYMENT_NOT_FOUND');
          
          results.push({
            transactionId: transaction.id,
            paymentId: transaction.paymentId,
            discrepancies
          });
          
          continue;
        }
        
        // Verificar si los montos coinciden
        if (payment.amount !== transaction.amount.toString()) {
          discrepancies.push('AMOUNT_MISMATCH');
        }
        
        // Verificar si el estado del pago está actualizado
        if (payment.status === 'PENDING' && transaction.status === StripeTransactionStatus.SUCCEEDED) {
          discrepancies.push('STATUS_MISMATCH');
        }
        
        // Si hay discrepancias, agregar a los resultados
        if (discrepancies.length > 0) {
          results.push({
            transactionId: transaction.id,
            paymentId: transaction.paymentId,
            discrepancies
          });
        }
      }
      
      return results;
    } catch (error) {
      logger.error('Error finding transactions needing reconciliation', error);
      throw error;
    }
  }

  /**
   * Reconciliar una transacción
   * Actualiza nuestros registros internos para que coincidan con Stripe
   */
  async reconcileTransaction(
    transactionId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Obtener la transacción
      const transaction = await StripeTransactionRepository.findById(transactionId);
      
      if (!transaction) {
        return {
          success: false,
          message: `Transaction not found: ${transactionId}`
        };
      }
      
      // Obtener el pago asociado
      const payment = await PaymentService.findById(transaction.paymentId);
      
      if (!payment) {
        return {
          success: false,
          message: `Payment not found: ${transaction.paymentId}`
        };
      }
      
      // Verificar si necesitamos actualizar el pago
      if (payment.status === 'PENDING' && transaction.status === StripeTransactionStatus.SUCCEEDED) {
        // Actualizar el estado del pago
        await PaymentService.updatePaymentStatusForStripe(
          payment.id,
          'PAYMENT_RECEIVED',
          {
            stripeChargeId: transaction.stripeChargeId,
            paymentMethod: transaction.paymentMethod,
            transactionDetails: {
              amount: transaction.amount,
              currency: transaction.currency,
              receiptUrl: transaction.receiptUrl
            }
          }
        );
        
        // Iniciar procesamiento de swap si es necesario
        await PaymentService.processPaymentSwap(payment.id);
        
        // Registrar la reconciliación
        await StripeTransactionRepository.update(
          transaction.id,
          {
            metadata: {
              ...transaction.metadata,
              reconciledAt: new Date().toISOString()
            }
          },
          'PAYMENT_RECONCILED'
        );
        
        return {
          success: true,
          message: `Successfully reconciled payment ${payment.id} with Stripe transaction`
        };
      }
      
      // No se necesitaron cambios
      return {
        success: true,
        message: 'No updates needed, transaction already reconciled'
      };
    } catch (error) {
      logger.error(`Error reconciling transaction ${transactionId}`, error);
      return {
        success: false,
        message: `Reconciliation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Mapear estado de Stripe a estado de transacción interno
   */
  private mapStripeStatusToTransactionStatus(stripeStatus: string): StripeTransactionStatus {
    switch (stripeStatus) {
      case 'succeeded':
        return StripeTransactionStatus.SUCCEEDED;
      case 'processing':
      case 'requires_action':
      case 'requires_capture':
      case 'requires_confirmation':
      case 'requires_payment_method':
        return StripeTransactionStatus.PENDING;
      case 'canceled':
        return StripeTransactionStatus.CANCELED;
      case 'requires_payment_method':
        return StripeTransactionStatus.FAILED;
      default:
        return StripeTransactionStatus.PENDING;
    }
  }
}

export default new StripeReconciliationService(); 