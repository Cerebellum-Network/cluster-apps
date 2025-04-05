import { ethers } from 'ethers';
import { 
  Payment, 
  PaymentStatus,
  TeleportTransaction,
  TeleportTransactionStatus
} from '../models';
import { HyperbridgeService } from './HyperbridgeService';
import logger from '../../utils/logger';
import { 
  MONITORING_INTERVAL_MS, 
  MAX_MONITORING_RETRIES
} from '../../config/env';

// Constantes específicas para el monitoreo de teleportación
const TELEPORT_MONITORING_INTERVAL_MS = MONITORING_INTERVAL_MS;
const MAX_TELEPORT_MONITORING_RETRIES = MAX_MONITORING_RETRIES;
const TELEPORT_MAX_CONFIRMATION_TIME_MS = 3600000; // 1 hora máximo para confirmación

/**
 * Service to monitor and handle Hyperbridge teleport operations
 * Implements task #6.1 - Hyperbridge Teleport Operation Monitoring Service
 */
export class TeleportMonitoringService {
  private monitoringJobs: Map<string, NodeJS.Timeout> = new Map();
  private retryCount: Map<string, number> = new Map();

  constructor(
    private hyperbridgeService: HyperbridgeService
  ) {}

  /**
   * Start monitoring a teleport transaction
   * @param teleportTxId The teleport transaction ID to monitor
   * @param paymentId The associated payment ID
   */
  async startMonitoring(teleportTxId: string, paymentId: string): Promise<void> {
    if (this.monitoringJobs.has(teleportTxId)) {
      logger.warn(`Teleport monitoring already active for transaction ${teleportTxId}`);
      return;
    }

    logger.info(`Starting teleport monitoring for transaction ${teleportTxId}`, { paymentId });

    // Set initial retry count
    this.retryCount.set(teleportTxId, 0);

    // Start monitoring interval
    const intervalId = setInterval(
      () => this.checkTeleportStatus(teleportTxId, paymentId),
      TELEPORT_MONITORING_INTERVAL_MS
    );

    this.monitoringJobs.set(teleportTxId, intervalId);

    // Set a timeout to stop monitoring after max time
    setTimeout(() => {
      if (this.monitoringJobs.has(teleportTxId)) {
        logger.warn(`Teleport monitoring timed out for transaction ${teleportTxId}`, { paymentId });
        this.handleTeleportTimeout(teleportTxId, paymentId);
      }
    }, TELEPORT_MAX_CONFIRMATION_TIME_MS);
  }

  /**
   * Stop monitoring a teleport transaction
   * @param teleportTxId The teleport transaction ID
   */
  stopMonitoring(teleportTxId: string): void {
    const intervalId = this.monitoringJobs.get(teleportTxId);
    if (intervalId) {
      clearInterval(intervalId);
      this.monitoringJobs.delete(teleportTxId);
      this.retryCount.delete(teleportTxId);
      logger.info(`Stopped teleport monitoring for transaction ${teleportTxId}`);
    }
  }

  /**
   * Check the status of a teleport transaction
   * @param teleportTxId The teleport transaction ID
   * @param paymentId The associated payment ID
   */
  private async checkTeleportStatus(teleportTxId: string, paymentId: string): Promise<void> {
    try {
      // Increment retry count
      const currentRetries = this.retryCount.get(teleportTxId) || 0;
      this.retryCount.set(teleportTxId, currentRetries + 1);

      // If max retries reached, handle the timeout
      if (currentRetries >= MAX_TELEPORT_MONITORING_RETRIES) {
        await this.handleTeleportTimeout(teleportTxId, paymentId);
        return;
      }

      // Get teleport transaction from database
      const teleportTx = await TeleportTransaction.findOne({
        where: { teleportTxId }
      });

      if (!teleportTx) {
        logger.error(`Teleport transaction ${teleportTxId} not found during monitoring`);
        this.stopMonitoring(teleportTxId);
        return;
      }

      // Get associated payment
      const payment = await Payment.findByPk(paymentId);
      if (!payment) {
        logger.error(`Payment ${paymentId} not found during teleport monitoring`);
        this.stopMonitoring(teleportTxId);
        return;
      }

      // Get teleport status with retry for network issues
      // Implement retries manualmente en lugar de usar RetryService
      let status;
      let retryAttempt = 0;
      const maxRetries = 3;
      const delayMs = 2000;

      while (retryAttempt <= maxRetries) {
        try {
          status = await this.hyperbridgeService.checkTeleportStatus(teleportTxId);
          break; // Si no hay error, salimos del bucle
        } catch (error) {
          retryAttempt++;
          if (retryAttempt > maxRetries) throw error;
          // Esperar antes del siguiente intento
          await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, retryAttempt - 1)));
        }
      }

      logger.info(`Teleport status check for ${teleportTxId}: ${status}`, { paymentId });

      // Update teleport transaction based on status
      if (status === TeleportTransactionStatus.COMPLETED) {
        await this.handleTeleportCompleted(teleportTx, payment);
      } else if (status === TeleportTransactionStatus.FAILED) {
        await this.handleTeleportFailed(teleportTx, payment, 'Teleport failed on Hyperbridge');
      } else if (status === TeleportTransactionStatus.PENDING) {
        // Si todavía está pendiente, continuamos monitoreando
        // Ya que nuestro enum no tiene INITIATED, usamos PENDING
        if (payment.status !== PaymentStatus.TELEPORT_INITIATED) {
          await payment.update({ status: PaymentStatus.TELEPORT_INITIATED });
        }
        // Continue monitoring
      }
    } catch (error) {
      logger.error(`Error checking teleport status for ${teleportTxId}:`, error);
      // Don't stop monitoring on error, let retry mechanism handle it
    }
  }

  /**
   * Handle a completed teleport
   */
  private async handleTeleportCompleted(
    teleportTx: TeleportTransaction,
    payment: Payment
  ): Promise<void> {
    try {
      await teleportTx.update({
        status: TeleportTransactionStatus.COMPLETED,
        confirmedAt: new Date()
      });

      await payment.update({ status: PaymentStatus.TELEPORT_CONFIRMED });

      logger.info(`Teleport completed for ${teleportTx.teleportTxId}`, { 
        paymentId: payment.id
      });

      // Stop monitoring as teleport is completed
      this.stopMonitoring(teleportTx.teleportTxId);
    } catch (error) {
      logger.error(`Error handling teleport completion for ${teleportTx.teleportTxId}:`, error);
    }
  }

  /**
   * Handle a failed teleport
   */
  private async handleTeleportFailed(
    teleportTx: TeleportTransaction,
    payment: Payment,
    reason: string
  ): Promise<void> {
    try {
      await teleportTx.update({
        status: TeleportTransactionStatus.FAILED,
        error: reason
      });

      await payment.update({
        status: PaymentStatus.FAILED,
        error: `Teleport failed: ${reason}`
      });

      logger.error(`Teleport failed for ${teleportTx.teleportTxId}: ${reason}`, {
        paymentId: payment.id
      });

      // Stop monitoring as teleport has failed
      this.stopMonitoring(teleportTx.teleportTxId);
    } catch (error) {
      logger.error(`Error handling teleport failure for ${teleportTx.teleportTxId}:`, error);
    }
  }

  /**
   * Handle a teleport timeout (max retries or max time reached)
   */
  private async handleTeleportTimeout(teleportTxId: string, paymentId: string): Promise<void> {
    try {
      const teleportTx = await TeleportTransaction.findOne({
        where: { teleportTxId }
      });

      if (!teleportTx) {
        logger.error(`Teleport transaction ${teleportTxId} not found during timeout handling`);
        this.stopMonitoring(teleportTxId);
        return;
      }

      const payment = await Payment.findByPk(paymentId);
      if (!payment) {
        logger.error(`Payment ${paymentId} not found during teleport timeout handling`);
        this.stopMonitoring(teleportTxId);
        return;
      }

      // First, try to get the final status one more time
      try {
        const finalStatus = await this.hyperbridgeService.checkTeleportStatus(teleportTxId);
        
        if (finalStatus === TeleportTransactionStatus.COMPLETED) {
          await this.handleTeleportCompleted(teleportTx, payment);
          return;
        } else if (finalStatus === TeleportTransactionStatus.FAILED) {
          await this.handleTeleportFailed(teleportTx, payment, 'Teleport failed on final check');
          return;
        }
      } catch (error) {
        logger.error(`Error during final teleport status check for ${teleportTxId}:`, error);
      }

      // If we got here, teleport is in an unknown state
      await teleportTx.update({
        status: TeleportTransactionStatus.FAILED, // Marcamos como fallido ya que no hay estado UNKNOWN
        error: 'Teleport monitoring timed out'
      });

      await payment.update({
        status: PaymentStatus.FAILED,
        error: 'Teleport monitoring timed out without confirmation'
      });

      logger.error(`Teleport monitoring timed out for ${teleportTxId}`, {
        paymentId,
        retries: this.retryCount.get(teleportTxId) || 0
      });

      // Stop monitoring
      this.stopMonitoring(teleportTxId);
    } catch (error) {
      logger.error(`Error handling teleport timeout for ${teleportTxId}:`, error);
      this.stopMonitoring(teleportTxId);
    }
  }

  /**
   * Recover monitoring for all pending teleports
   * Used when service restarts to resume monitoring
   */
  async recoverPendingTeleports(): Promise<void> {
    try {
      // Find all teleport transactions that are in a non-final state
      const pendingTeleports = await TeleportTransaction.findAll({
        where: {
          status: [
            TeleportTransactionStatus.PENDING
          ]
        },
        include: [{
          model: Payment,
          required: true
        }]
      });

      logger.info(`Recovering monitoring for ${pendingTeleports.length} pending teleports`);

      // Start monitoring each pending teleport
      for (const teleport of pendingTeleports) {
        this.startMonitoring(teleport.teleportTxId, teleport.paymentId);
      }
    } catch (error) {
      logger.error('Error recovering pending teleports:', error);
    }
  }
} 