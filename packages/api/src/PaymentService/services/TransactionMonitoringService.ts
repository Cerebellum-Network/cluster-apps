import { ethers } from 'ethers';
import { 
  Payment, 
  PaymentStatus,
  StablecoinTransaction,
  StablecoinTransactionStatus,
  SwapTransaction,
  SwapTransactionStatus,
  TeleportTransaction,
  TeleportTransactionStatus,
  DDCAccountUpdate,
  DDCAccountUpdateStatus
} from '../models';
import { ContractService } from './ContractService';
import { HyperbridgeService } from './HyperbridgeService';
import logger, { logTransaction } from '../../utils/logger';
import { MONITORING_INTERVAL_MS, MAX_MONITORING_RETRIES } from '../../config/env';

export class TransactionMonitoringService {
  private monitoringJobs: Map<string, NodeJS.Timeout>;
  private retryCount: Map<string, number>;

  constructor(
    private contractService: ContractService,
    private hyperbridgeService: HyperbridgeService
  ) {
    this.monitoringJobs = new Map();
    this.retryCount = new Map();
  }

  /**
   * Start monitoring a payment's transactions
   */
  async startMonitoring(payment: Payment): Promise<void> {
    const paymentId = payment.id;
    
    if (this.monitoringJobs.has(paymentId)) {
      logger.warn(`Monitoring already active for payment ${paymentId}`);
      return;
    }

    // Log start of monitoring
    logTransaction(paymentId, 'START_MONITORING', 'INITIATED', {
      status: payment.status,
      timestamp: new Date().toISOString()
    });

    // Start monitoring interval
    const intervalId = setInterval(
      () => this.checkTransactionStatus(paymentId),
      MONITORING_INTERVAL_MS
    );

    this.monitoringJobs.set(paymentId, intervalId);
    this.retryCount.set(paymentId, 0);
  }

  /**
   * Stop monitoring a payment's transactions
   */
  stopMonitoring(paymentId: string): void {
    const intervalId = this.monitoringJobs.get(paymentId);
    if (intervalId) {
      clearInterval(intervalId);
      this.monitoringJobs.delete(paymentId);
      this.retryCount.delete(paymentId);

      logTransaction(paymentId, 'STOP_MONITORING', 'COMPLETED', {
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Check the status of all transactions for a payment
   */
  private async checkTransactionStatus(paymentId: string): Promise<void> {
    try {
      const payment = await Payment.findByPk(paymentId, {
        include: [
          { model: StablecoinTransaction, as: 'stablecoinTransactions' },
          { model: SwapTransaction, as: 'swapTransactions' },
          { model: TeleportTransaction, as: 'teleportTransactions' },
          { model: DDCAccountUpdate, as: 'ddcAccountUpdates' }
        ]
      });

      if (!payment) {
        logger.error(`Payment ${paymentId} not found during monitoring`);
        this.stopMonitoring(paymentId);
        return;
      }

      // If payment is in final state, stop monitoring
      if (payment.status === PaymentStatus.COMPLETED || payment.status === PaymentStatus.FAILED) {
        this.stopMonitoring(paymentId);
        return;
      }

      // Check stablecoin transaction if in relevant state
      if (payment.status === PaymentStatus.PROCESSING_PAYMENT) {
        await this.checkStablecoinTransaction(payment);
      }

      // Check swap transaction if in relevant state
      if (payment.status === PaymentStatus.SWAPPING_TOKENS) {
        await this.checkSwapTransaction(payment);
      }

      // Check teleport transaction if in relevant state
      if (payment.status === PaymentStatus.TELEPORTING || 
          payment.status === PaymentStatus.TELEPORT_INITIATED) {
        await this.checkTeleportTransaction(payment);
      }

      // Check DDC account update if in relevant state
      if (payment.status === PaymentStatus.UPDATING_DDC) {
        await this.checkDDCAccountUpdate(payment);
      }

      // Increment retry count
      const currentRetries = this.retryCount.get(paymentId) || 0;
      this.retryCount.set(paymentId, currentRetries + 1);

      // If max retries reached, mark as failed
      if (currentRetries >= MAX_MONITORING_RETRIES) {
        await payment.update({ 
          status: PaymentStatus.FAILED,
          error: 'Max monitoring retries reached'
        });
        this.stopMonitoring(paymentId);
      }

    } catch (error) {
      logger.error(`Error monitoring payment ${paymentId}:`, error);
      // Don't stop monitoring on error, let retry mechanism handle it
    }
  }

  /**
   * Check status of stablecoin transaction
   */
  private async checkStablecoinTransaction(payment: Payment): Promise<void> {
    const stablecoinTx = payment.stablecoinTransactions?.[0];
    if (!stablecoinTx || !stablecoinTx.transactionHash) return;

    try {
      const receipt = await this.contractService.getTransactionReceipt(stablecoinTx.transactionHash);
      
      if (receipt && receipt.status === 1) {
        await stablecoinTx.update({
          status: StablecoinTransactionStatus.CONFIRMED,
          blockNumber: receipt.blockNumber
        });
        await payment.update({ status: PaymentStatus.PAYMENT_RECEIVED });
        
        logTransaction(payment.id, 'STABLECOIN_CONFIRMATION', 'SUCCESS', {
          txHash: stablecoinTx.transactionHash,
          blockNumber: receipt.blockNumber
        });
      } else if (receipt && receipt.status === 0) {
        await stablecoinTx.update({
          status: StablecoinTransactionStatus.FAILED,
          error: 'Transaction reverted'
        });
        await payment.update({ 
          status: PaymentStatus.FAILED,
          error: 'Stablecoin transaction failed'
        });
      }
    } catch (error) {
      logger.error(`Error checking stablecoin transaction ${stablecoinTx.transactionHash}:`, error);
    }
  }

  /**
   * Check status of swap transaction
   */
  private async checkSwapTransaction(payment: Payment): Promise<void> {
    const swapTx = payment.swapTransactions?.[0];
    if (!swapTx || !swapTx.txHash) return;

    try {
      const receipt = await this.contractService.getTransactionReceipt(swapTx.txHash);
      
      if (receipt && receipt.status === 1) {
        await swapTx.update({
          status: SwapTransactionStatus.COMPLETED,
          blockNumber: receipt.blockNumber
        });
        await payment.update({ status: PaymentStatus.TOKENS_SWAPPED });
        
        logTransaction(payment.id, 'SWAP_CONFIRMATION', 'SUCCESS', {
          txHash: swapTx.txHash,
          blockNumber: receipt.blockNumber
        });
      } else if (receipt && receipt.status === 0) {
        await swapTx.update({
          status: SwapTransactionStatus.FAILED,
          error: 'Transaction reverted'
        });
        await payment.update({ 
          status: PaymentStatus.FAILED,
          error: 'Swap transaction failed'
        });
      }
    } catch (error) {
      logger.error(`Error checking swap transaction ${swapTx.txHash}:`, error);
    }
  }

  /**
   * Check status of teleport transaction
   */
  private async checkTeleportTransaction(payment: Payment): Promise<void> {
    const teleportTx = payment.teleportTransactions?.[0];
    if (!teleportTx || !teleportTx.teleportTxId) return;

    try {
      const status = await this.hyperbridgeService.checkTeleportStatus(teleportTx.teleportTxId);
      
      if (status === TeleportTransactionStatus.COMPLETED) {
        await teleportTx.update({
          status: TeleportTransactionStatus.COMPLETED,
          confirmedAt: new Date()
        });
        await payment.update({ status: PaymentStatus.TELEPORT_CONFIRMED });
        
        logTransaction(payment.id, 'TELEPORT_CONFIRMATION', 'SUCCESS', {
          txId: teleportTx.teleportTxId,
          timestamp: new Date().toISOString()
        });
      } else if (status === TeleportTransactionStatus.FAILED) {
        await teleportTx.update({
          status: TeleportTransactionStatus.FAILED,
          error: 'Teleport failed on Hyperbridge'
        });
        await payment.update({ 
          status: PaymentStatus.FAILED,
          error: 'Teleport transaction failed'
        });
      }
    } catch (error) {
      logger.error(`Error checking teleport transaction ${teleportTx.teleportTxId}:`, error);
    }
  }

  /**
   * Check status of DDC account update
   */
  private async checkDDCAccountUpdate(payment: Payment): Promise<void> {
    const ddcUpdate = payment.ddcAccountUpdates?.[0];
    if (!ddcUpdate || !ddcUpdate.txHash) return;

    try {
      const status = await this.contractService.checkDDCUpdateStatus(ddcUpdate.txHash);
      
      if (status === 'confirmed') {
        await ddcUpdate.update({
          status: DDCAccountUpdateStatus.COMPLETED
        });
        await payment.update({ status: PaymentStatus.COMPLETED });
        
        logTransaction(payment.id, 'DDC_UPDATE_CONFIRMATION', 'SUCCESS', {
          txHash: ddcUpdate.txHash,
          timestamp: new Date().toISOString()
        });
      } else if (status === 'failed') {
        await ddcUpdate.update({
          status: DDCAccountUpdateStatus.FAILED,
          error: 'DDC account update failed'
        });
        await payment.update({ 
          status: PaymentStatus.FAILED,
          error: 'DDC account update failed'
        });
      }
    } catch (error) {
      logger.error(`Error checking DDC account update ${ddcUpdate.txHash}:`, error);
    }
  }
} 