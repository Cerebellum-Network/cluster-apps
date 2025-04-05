import { 
  Payment, 
  PaymentStatus,
  DDCAccountUpdate,
  DDCAccountUpdateStatus,
  TeleportTransaction,
  TeleportTransactionStatus,
  SwapTransaction,
  SwapTransactionStatus,
  StablecoinTransaction,
  StablecoinTransactionStatus
} from '../models';
import { CereBlockchainService } from './CereBlockchainService';
import { HyperbridgeService } from './HyperbridgeService';
import { TeleportMonitoringService } from './TeleportMonitoringService';
import { BalanceVerificationService } from './BalanceVerificationService';
import { RetryService } from './RetryService';
import { DexService } from './DexService';
import { ContractService } from './ContractService';
import logger from '../../utils/logger';
import { Op } from 'sequelize';
import { 
  EDGE_CASE_MAX_RETRIES,
  EDGE_CASE_INCOMPLETE_TX_THRESHOLD_MS,
  EDGE_CASE_STUCK_TX_THRESHOLD_MS,
  EDGE_CASE_PARTIAL_AMOUNT_THRESHOLD_PERCENT
} from '../config/env';

/**
 * Service for handling edge cases and implementing recovery mechanisms
 * for the payment flow.
 * Implements task #6.4 - Implement Edge Case Handling and Recovery Mechanisms
 */
export class EdgeCaseHandler {
  
  constructor(
    private cereBlockchainService: CereBlockchainService,
    private hyperbridgeService: HyperbridgeService,
    private teleportMonitoringService: TeleportMonitoringService,
    private balanceVerificationService: BalanceVerificationService,
    private retryService: RetryService,
    private dexService: DexService,
    private contractService: ContractService
  ) {}
  
  /**
   * Find and recover all stuck payments in the system
   * This should be run periodically via a cron job
   */
  async recoverStuckPayments(): Promise<{ recovered: number, failed: number }> {
    logger.info(`Starting recovery of stuck payments`);
    
    const results = {
      recovered: 0,
      failed: 0
    };
    
    try {
      // Find all payments that aren't in a final state
      const stuckPayments = await Payment.findAll({
        where: {
          status: {
            [Op.notIn]: [PaymentStatus.COMPLETED, PaymentStatus.FAILED]
          },
          updatedAt: {
            [Op.lt]: new Date(Date.now() - EDGE_CASE_STUCK_TX_THRESHOLD_MS)
          }
        },
        include: [
          { model: StablecoinTransaction, as: 'stablecoinTransactions' },
          { model: SwapTransaction, as: 'swapTransactions' },
          { model: TeleportTransaction, as: 'teleportTransactions' },
          { model: DDCAccountUpdate, as: 'ddcAccountUpdates' }
        ]
      });
      
      logger.info(`Found ${stuckPayments.length} stuck payments`);
      
      for (const payment of stuckPayments) {
        try {
          const recovered = await this.recoverPayment(payment);
          if (recovered) {
            results.recovered++;
          } else {
            results.failed++;
          }
        } catch (error) {
          logger.error(`Error recovering payment ${payment.id}:`, error);
          results.failed++;
        }
      }
      
      return results;
    } catch (error) {
      logger.error(`Error finding stuck payments:`, error);
      throw error;
    }
  }
  
  /**
   * Find and recover incomplete teleport operations
   */
  async recoverIncompleteTeleports(): Promise<{ recovered: number, failed: number }> {
    logger.info(`Starting recovery of incomplete teleports`);
    
    const results = {
      recovered: 0,
      failed: 0
    };
    
    try {
      // Find all teleport transactions that are not in a final state
      const incompleteTeleports = await TeleportTransaction.findAll({
        where: {
          status: {
            [Op.notIn]: [TeleportTransactionStatus.COMPLETED, TeleportTransactionStatus.FAILED]
          },
          updatedAt: {
            [Op.lt]: new Date(Date.now() - EDGE_CASE_INCOMPLETE_TX_THRESHOLD_MS)
          }
        },
        include: [{ model: Payment, as: 'payment' }]
      });
      
      logger.info(`Found ${incompleteTeleports.length} incomplete teleport transactions`);
      
      for (const teleport of incompleteTeleports) {
        try {
          const recovered = await this.recoverTeleport(teleport);
          if (recovered) {
            results.recovered++;
          } else {
            results.failed++;
          }
        } catch (error) {
          logger.error(`Error recovering teleport ${teleport.id}:`, error);
          results.failed++;
        }
      }
      
      return results;
    } catch (error) {
      logger.error(`Error finding incomplete teleports:`, error);
      throw error;
    }
  }
  
  /**
   * Find and recover incomplete DDC account updates
   */
  async recoverIncompleteDDCUpdates(): Promise<{ recovered: number, failed: number }> {
    logger.info(`Starting recovery of incomplete DDC account updates`);
    
    const results = {
      recovered: 0,
      failed: 0
    };
    
    try {
      // Find all DDC account updates that are not in a final state
      const incompleteDDCUpdates = await DDCAccountUpdate.findAll({
        where: {
          status: {
            [Op.notIn]: [DDCAccountUpdateStatus.COMPLETED, DDCAccountUpdateStatus.FAILED]
          },
          updatedAt: {
            [Op.lt]: new Date(Date.now() - EDGE_CASE_INCOMPLETE_TX_THRESHOLD_MS)
          }
        },
        include: [{ model: Payment, as: 'payment' }]
      });
      
      logger.info(`Found ${incompleteDDCUpdates.length} incomplete DDC account updates`);
      
      for (const ddcUpdate of incompleteDDCUpdates) {
        try {
          const recovered = await this.retryDDCUpdate(ddcUpdate);
          if (recovered) {
            results.recovered++;
          } else {
            results.failed++;
          }
        } catch (error) {
          logger.error(`Error recovering DDC update ${ddcUpdate.id}:`, error);
          results.failed++;
        }
      }
      
      return results;
    } catch (error) {
      logger.error(`Error finding incomplete DDC updates:`, error);
      throw error;
    }
  }
  
  /**
   * Handle a payment with a partial amount received
   * This could happen if fees were deducted during transfer or if multiple
   * partial payments were made
   */
  async handlePartialPayment(paymentId: string): Promise<boolean> {
    logger.info(`Handling partial payment for ${paymentId}`);
    
    try {
      const payment = await Payment.findByPk(paymentId, {
        include: [{ model: StablecoinTransaction, as: 'stablecoinTransactions' }]
      });
      
      if (!payment) {
        logger.error(`Payment ${paymentId} not found`);
        return false;
      }
      
      if (!payment.stablecoinTransactions || payment.stablecoinTransactions.length === 0) {
        logger.error(`No stablecoin transactions found for payment ${paymentId}`);
        return false;
      }
      
      const stablecoinTx = payment.stablecoinTransactions[0];
      
      // Check if we received less than expected but above the threshold
      const expectedAmount = parseFloat(payment.amount);
      const receivedAmount = parseFloat(stablecoinTx.amount);
      const threshold = expectedAmount * (1 - EDGE_CASE_PARTIAL_AMOUNT_THRESHOLD_PERCENT / 100);
      
      if (receivedAmount < expectedAmount && receivedAmount >= threshold) {
        // Update payment with the actual received amount
        await payment.update({
          amount: stablecoinTx.amount,
          status: PaymentStatus.PAYMENT_RECEIVED,
          metadata: {
            ...payment.metadata,
            originalAmount: payment.amount,
            partialPayment: true,
            amountDifference: (expectedAmount - receivedAmount).toString()
          }
        });
        
        logger.info(`Accepted partial payment for ${paymentId}. Expected: ${expectedAmount}, Received: ${receivedAmount}`);
        
        // Continue with the payment flow
        if (payment.status === PaymentStatus.PAYMENT_RECEIVED) {
          // Trigger next step in the payment flow (e.g., swap tokens)
          // This would typically be handled by another service
        }
        
        return true;
      } else if (receivedAmount < threshold) {
        // Amount is too low, mark as failed or handle differently
        await payment.update({
          status: PaymentStatus.FAILED,
          error: `Received amount (${receivedAmount}) is below threshold (${threshold})`
        });
        
        logger.warn(`Partial payment ${paymentId} rejected: amount too low. Expected: ${expectedAmount}, Received: ${receivedAmount}, Threshold: ${threshold}`);
        return false;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error handling partial payment ${paymentId}:`, error);
      return false;
    }
  }
  
  /**
   * Recover a payment based on its current status
   */
  private async recoverPayment(payment: Payment): Promise<boolean> {
    logger.info(`Attempting to recover payment ${payment.id} with status ${payment.status}`);
    
    try {
      switch (payment.status) {
        case PaymentStatus.PENDING:
          // Payment hasn't started processing yet
          return this.recoverPendingPayment(payment);
          
        case PaymentStatus.PROCESSING_PAYMENT:
          // Payment is being processed (stablecoin receipt)
          return this.recoverProcessingPayment(payment);
          
        case PaymentStatus.PAYMENT_RECEIVED:
          // Payment received but swap not started
          return this.recoverPaymentReceivedState(payment);
          
        case PaymentStatus.SWAPPING_TOKENS:
          // Tokens are being swapped
          return this.recoverSwappingTokensState(payment);
          
        case PaymentStatus.TOKENS_SWAPPED:
          // Tokens swapped but teleport not started
          return this.recoverTokensSwappedState(payment);
          
        case PaymentStatus.TELEPORTING:
        case PaymentStatus.TELEPORT_INITIATED:
          // Tokens are being teleported
          return this.recoverTeleportingState(payment);
          
        case PaymentStatus.TELEPORT_CONFIRMED:
          // Teleport confirmed but DDC update not started
          return this.recoverTeleportConfirmedState(payment);
          
        case PaymentStatus.UPDATING_DDC:
          // DDC account is being updated
          return this.recoverUpdatingDDCState(payment);
          
        default:
          logger.warn(`No recovery action defined for payment ${payment.id} with status ${payment.status}`);
          return false;
      }
    } catch (error) {
      logger.error(`Error recovering payment ${payment.id}:`, error);
      return false;
    }
  }
  
  /**
   * Recover a payment in PENDING state
   */
  private async recoverPendingPayment(payment: Payment): Promise<boolean> {
    // If payment is stuck in PENDING for too long, it might be abandoned
    // Mark as failed or take other appropriate action
    await payment.update({
      status: PaymentStatus.FAILED,
      error: 'Payment abandoned (stuck in PENDING state)'
    });
    
    logger.info(`Marked abandoned payment ${payment.id} as failed`);
    return true;
  }
  
  /**
   * Recover a payment in PROCESSING_PAYMENT state
   */
  private async recoverProcessingPayment(payment: Payment): Promise<boolean> {
    if (!payment.stablecoinTransactions || payment.stablecoinTransactions.length === 0) {
      logger.error(`No stablecoin transactions found for payment ${payment.id}`);
      return false;
    }
    
    const stablecoinTx = payment.stablecoinTransactions[0];
    
    // Check the actual transaction status on the blockchain
    if (stablecoinTx.transactionHash) {
      try {
        const receipt = await this.contractService.getTransactionReceipt(stablecoinTx.transactionHash);
        
        if (!receipt) {
          // Transaction might be still pending or lost
          // Resubmit if it's been too long
          return await this.retryService.retryStablecoinTransaction(payment.id);
        } else if (receipt.status === 1) {
          // Transaction succeeded but our system didn't update
          await stablecoinTx.update({
            status: StablecoinTransactionStatus.CONFIRMED,
            blockNumber: receipt.blockNumber
          });
          
          await payment.update({
            status: PaymentStatus.PAYMENT_RECEIVED
          });
          
          logger.info(`Recovered stablecoin transaction for payment ${payment.id}`);
          return true;
        } else {
          // Transaction failed
          await stablecoinTx.update({
            status: StablecoinTransactionStatus.FAILED,
            error: 'Transaction reverted on blockchain'
          });
          
          await payment.update({
            status: PaymentStatus.FAILED,
            error: 'Stablecoin transaction failed on blockchain'
          });
          
          logger.info(`Marked failed stablecoin transaction for payment ${payment.id}`);
          return true;
        }
      } catch (error) {
        logger.error(`Error checking stablecoin transaction for payment ${payment.id}:`, error);
        return false;
      }
    } else {
      // No transaction hash, might be waiting for user to send payment
      // If it's been too long, mark as failed or take other appropriate action
      await payment.update({
        status: PaymentStatus.FAILED,
        error: 'No stablecoin transaction hash found after timeout'
      });
      
      logger.info(`Marked payment ${payment.id} as failed due to missing transaction hash`);
      return true;
    }
  }
  
  /**
   * Recover a payment in PAYMENT_RECEIVED state
   */
  private async recoverPaymentReceivedState(payment: Payment): Promise<boolean> {
    // Payment received but swap not initiated
    // Trigger the swap process
    try {
      const amountIn = payment.amount;
      const tx = await this.dexService.swapExactTokensForTokens(
        amountIn,
        payment.id
      );
      
      logger.info(`Initiated token swap for recovered payment ${payment.id}`);
      return true;
    } catch (error) {
      logger.error(`Error initiating token swap for payment ${payment.id}:`, error);
      return false;
    }
  }
  
  /**
   * Recover a payment in SWAPPING_TOKENS state
   */
  private async recoverSwappingTokensState(payment: Payment): Promise<boolean> {
    if (!payment.swapTransactions || payment.swapTransactions.length === 0) {
      logger.error(`No swap transactions found for payment ${payment.id}`);
      return false;
    }
    
    const swapTx = payment.swapTransactions[0];
    
    // Check the actual transaction status on the blockchain
    if (swapTx.txHash) {
      try {
        const receipt = await this.contractService.getTransactionReceipt(swapTx.txHash);
        
        if (!receipt) {
          // Transaction might be still pending or lost
          // Resubmit if it's been too long
          return await this.retryService.retrySwapTransaction(payment.id);
        } else if (receipt.status === 1) {
          // Transaction succeeded but our system didn't update
          await swapTx.update({
            status: SwapTransactionStatus.COMPLETED,
            blockNumber: receipt.blockNumber
          });
          
          await payment.update({
            status: PaymentStatus.TOKENS_SWAPPED
          });
          
          logger.info(`Recovered swap transaction for payment ${payment.id}`);
          return true;
        } else {
          // Transaction failed
          await swapTx.update({
            status: SwapTransactionStatus.FAILED,
            error: 'Transaction reverted on blockchain'
          });
          
          await payment.update({
            status: PaymentStatus.FAILED,
            error: 'Swap transaction failed on blockchain'
          });
          
          logger.info(`Marked failed swap transaction for payment ${payment.id}`);
          return true;
        }
      } catch (error) {
        logger.error(`Error checking swap transaction for payment ${payment.id}:`, error);
        return false;
      }
    } else {
      // No transaction hash, this is unexpected
      await payment.update({
        status: PaymentStatus.FAILED,
        error: 'No swap transaction hash found after timeout'
      });
      
      logger.info(`Marked payment ${payment.id} as failed due to missing swap transaction hash`);
      return true;
    }
  }
  
  /**
   * Recover a payment in TOKENS_SWAPPED state
   */
  private async recoverTokensSwappedState(payment: Payment): Promise<boolean> {
    // Tokens swapped but teleport not initiated
    // Trigger the teleport process
    try {
      // Get the CERE amount from the swap transaction or payment
      // @ts-ignore - cereAmount may need interface updating
      const cereAmount = payment.cereAmount;
      // @ts-ignore - cereNetworkAddress may need interface updating
      const cereNetworkAddress = payment.cereNetworkAddress;
      
      if (!cereAmount || !cereNetworkAddress) {
        logger.error(`Missing CERE amount or network address for payment ${payment.id}`);
        return false;
      }
      
      // Initiate teleport
      const teleportTxId = await this.hyperbridgeService.teleportToCereNetwork(
        cereAmount,
        cereNetworkAddress
      );
      
      // Create teleport transaction record
      await TeleportTransaction.create({
        paymentId: payment.id,
        teleportTxId,
        status: TeleportTransactionStatus.INITIATED
      });
      
      // Update payment status
      await payment.update({
        status: PaymentStatus.TELEPORT_INITIATED
      });
      
      // Start monitoring the teleport
      await this.teleportMonitoringService.startMonitoring(teleportTxId, payment.id);
      
      logger.info(`Initiated teleport for recovered payment ${payment.id}`);
      return true;
    } catch (error) {
      logger.error(`Error initiating teleport for payment ${payment.id}:`, error);
      return false;
    }
  }
  
  /**
   * Recover a payment in TELEPORT_INITIATED or TELEPORTING state
   */
  private async recoverTeleportingState(payment: Payment): Promise<boolean> {
    if (!payment.teleportTransactions || payment.teleportTransactions.length === 0) {
      logger.error(`No teleport transactions found for payment ${payment.id}`);
      return false;
    }
    
    const teleportTx = payment.teleportTransactions[0];
    
    // Restart teleport monitoring
    try {
      await this.teleportMonitoringService.startMonitoring(teleportTx.teleportTxId, payment.id);
      logger.info(`Restarted teleport monitoring for payment ${payment.id}`);
      return true;
    } catch (error) {
      logger.error(`Error restarting teleport monitoring for payment ${payment.id}:`, error);
      return false;
    }
  }
  
  /**
   * Recover a payment in TELEPORT_CONFIRMED state
   */
  private async recoverTeleportConfirmedState(payment: Payment): Promise<boolean> {
    if (!payment.teleportTransactions || payment.teleportTransactions.length === 0) {
      logger.error(`No teleport transactions found for payment ${payment.id}`);
      return false;
    }
    
    const teleportTx = payment.teleportTransactions[0];
    
    // Initiate DDC account update
    try {
      await this.balanceVerificationService.startVerification(payment.id, teleportTx.teleportTxId);
      logger.info(`Started balance verification for recovered payment ${payment.id}`);
      return true;
    } catch (error) {
      logger.error(`Error starting balance verification for payment ${payment.id}:`, error);
      return false;
    }
  }
  
  /**
   * Recover a payment in UPDATING_DDC state
   */
  private async recoverUpdatingDDCState(payment: Payment): Promise<boolean> {
    if (!payment.ddcAccountUpdates || payment.ddcAccountUpdates.length === 0) {
      logger.error(`No DDC account updates found for payment ${payment.id}`);
      return false;
    }
    
    const ddcUpdate = payment.ddcAccountUpdates[0];
    
    // Retry DDC account update
    try {
      const result = await this.balanceVerificationService.retryFailedUpdate(ddcUpdate.id);
      if (result) {
        logger.info(`Retried DDC account update for payment ${payment.id}`);
        return true;
      } else {
        logger.warn(`Failed to retry DDC account update for payment ${payment.id}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error retrying DDC account update for payment ${payment.id}:`, error);
      return false;
    }
  }
  
  /**
   * Recover a stuck teleport transaction
   */
  private async recoverTeleport(teleport: TeleportTransaction): Promise<boolean> {
    logger.info(`Attempting to recover teleport ${teleport.id} (${teleport.teleportTxId}) with status ${teleport.status}`);
    
    switch (teleport.status) {
      case TeleportTransactionStatus.PENDING:
      case TeleportTransactionStatus.INITIATED:
        // Restart teleport monitoring
        try {
          if (teleport.payment) {
            await this.teleportMonitoringService.startMonitoring(
              teleport.teleportTxId,
              teleport.payment.id
            );
            logger.info(`Restarted teleport monitoring for teleport ${teleport.id}`);
            return true;
          } else {
            logger.error(`No payment found for teleport ${teleport.id}`);
            return false;
          }
        } catch (error) {
          logger.error(`Error restarting teleport monitoring for teleport ${teleport.id}:`, error);
          return false;
        }
        
      default:
        logger.warn(`No recovery action defined for teleport ${teleport.id} with status ${teleport.status}`);
        return false;
    }
  }
  
  /**
   * Retry a failed or stuck DDC update
   */
  private async retryDDCUpdate(ddcUpdate: DDCAccountUpdate): Promise<boolean> {
    logger.info(`Attempting to retry DDC update ${ddcUpdate.id} with status ${ddcUpdate.status}`);
    
    try {
      const result = await this.balanceVerificationService.retryFailedUpdate(ddcUpdate.id);
      if (result) {
        logger.info(`Successfully retried DDC update ${ddcUpdate.id}`);
        return true;
      } else {
        logger.warn(`Failed to retry DDC update ${ddcUpdate.id}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error retrying DDC update ${ddcUpdate.id}:`, error);
      return false;
    }
  }
  
  /**
   * Diagnose and report issues with a payment
   * This is useful for customer support and debugging
   */
  async diagnosePayment(paymentId: string): Promise<any> {
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
        return { error: `Payment ${paymentId} not found` };
      }
      
      const diagnosis = {
        paymentId: payment.id,
        status: payment.status,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        timeSinceLastUpdate: Date.now() - payment.updatedAt.getTime(),
        error: payment.error || null,
        transactions: {
          stablecoin: payment.stablecoinTransactions?.map(tx => ({
            id: tx.id,
            status: tx.status,
            hash: tx.transactionHash,
            amount: tx.amount,
            error: tx.error || null
          })) || [],
          swap: payment.swapTransactions?.map(tx => ({
            id: tx.id,
            status: tx.status,
            hash: tx.txHash,
            error: tx.error || null
          })) || [],
          teleport: payment.teleportTransactions?.map(tx => ({
            id: tx.id,
            status: tx.status,
            teleportTxId: tx.teleportTxId,
            error: tx.error || null
          })) || [],
          ddcUpdate: payment.ddcAccountUpdates?.map(update => ({
            id: update.id,
            status: update.status,
            txHash: update.txHash,
            error: update.error || null
          })) || []
        },
        isStuck: false,
        stuckReason: null,
        recommendedAction: null
      };
      
      // Check if payment is stuck
      const timeSinceUpdate = Date.now() - payment.updatedAt.getTime();
      if (
        timeSinceUpdate > EDGE_CASE_STUCK_TX_THRESHOLD_MS &&
        payment.status !== PaymentStatus.COMPLETED &&
        payment.status !== PaymentStatus.FAILED
      ) {
        diagnosis.isStuck = true;
        
        // Determine where the payment is stuck
        switch (payment.status) {
          case PaymentStatus.PENDING:
            diagnosis.stuckReason = 'Payment has been stuck in PENDING state';
            diagnosis.recommendedAction = 'Restart payment or contact the user to initiate a new payment';
            break;
            
          case PaymentStatus.PROCESSING_PAYMENT:
            diagnosis.stuckReason = 'Waiting for stablecoin transaction confirmation';
            diagnosis.recommendedAction = 'Check transaction on blockchain and retry if necessary';
            break;
            
          case PaymentStatus.PAYMENT_RECEIVED:
            diagnosis.stuckReason = 'Payment received but swap not initiated';
            diagnosis.recommendedAction = 'Manually trigger token swap';
            break;
            
          case PaymentStatus.SWAPPING_TOKENS:
            diagnosis.stuckReason = 'Token swap in progress for too long';
            diagnosis.recommendedAction = 'Check swap transaction on blockchain and retry if necessary';
            break;
            
          case PaymentStatus.TOKENS_SWAPPED:
            diagnosis.stuckReason = 'Tokens swapped but teleport not initiated';
            diagnosis.recommendedAction = 'Manually trigger teleport';
            break;
            
          case PaymentStatus.TELEPORTING:
          case PaymentStatus.TELEPORT_INITIATED:
            diagnosis.stuckReason = 'Teleport in progress for too long';
            diagnosis.recommendedAction = 'Check teleport status and restart monitoring';
            break;
            
          case PaymentStatus.TELEPORT_CONFIRMED:
            diagnosis.stuckReason = 'Teleport confirmed but DDC account not updated';
            diagnosis.recommendedAction = 'Manually trigger DDC account update';
            break;
            
          case PaymentStatus.UPDATING_DDC:
            diagnosis.stuckReason = 'DDC account update in progress for too long';
            diagnosis.recommendedAction = 'Retry DDC account update';
            break;
        }
      }
      
      return diagnosis;
    } catch (error) {
      logger.error(`Error diagnosing payment ${paymentId}:`, error);
      return { error: `Failed to diagnose payment ${paymentId}: ${error.message}` };
    }
  }
  
  /**
   * Manually trigger the next step in the payment flow
   * This is useful for customer support to advance stuck payments
   */
  async triggerNextStep(paymentId: string): Promise<boolean> {
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
        logger.error(`Payment ${paymentId} not found`);
        return false;
      }
      
      // Recovery based on current state
      return await this.recoverPayment(payment);
    } catch (error) {
      logger.error(`Error triggering next step for payment ${paymentId}:`, error);
      return false;
    }
  }
} 