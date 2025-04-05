import { ethers } from 'ethers';
import { 
  Payment, 
  PaymentStatus,
  DDCAccountUpdate,
  DDCAccountUpdateStatus,
  TeleportTransaction,
  TeleportTransactionStatus
} from '../models';
import { CereBlockchainService } from './CereBlockchainService';
import { RetryService } from './RetryService';
import logger from '../../utils/logger';
import {
  BALANCE_VERIFICATION_DELAY_MS,
  BALANCE_VERIFICATION_MAX_RETRIES,
  BALANCE_VERIFICATION_TIMEOUT_MS,
  BALANCE_EXPECTED_INCREASE_MARGIN
} from '../config/env';

/**
 * Service to verify balance updates on Cere Network
 * Implements task #6.3 - Implement Balance Update Verification System
 */
export class BalanceVerificationService {
  constructor(
    private cereBlockchainService: CereBlockchainService,
    private retryService: RetryService
  ) {}

  /**
   * Start balance verification process for a completed teleport
   * @param paymentId The payment ID
   * @param teleportTxId The teleport transaction ID
   */
  async startVerification(paymentId: string, teleportTxId: string): Promise<void> {
    logger.info(`Starting balance verification for payment ${paymentId}`, { teleportTxId });

    try {
      // Find the teleport transaction and payment
      const teleportTx = await TeleportTransaction.findOne({
        where: { teleportTxId }
      });

      if (!teleportTx) {
        throw new Error(`Teleport transaction ${teleportTxId} not found`);
      }

      if (teleportTx.status !== TeleportTransactionStatus.COMPLETED) {
        throw new Error(`Teleport transaction ${teleportTxId} is not completed (status: ${teleportTx.status})`);
      }

      const payment = await Payment.findByPk(paymentId);
      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      // Update payment status to reflect we're updating the DDC account
      await payment.update({ status: PaymentStatus.UPDATING_DDC });

      // Get the Cere Network address
      // @ts-ignore - Payment model may need interface updating
      const cereNetworkAddress = payment.cereNetworkAddress;
      if (!cereNetworkAddress) {
        throw new Error(`No Cere Network address found for payment ${paymentId}`);
      }

      // Get the CERE amount
      // @ts-ignore - Payment model may need interface updating
      const cereAmount = payment.cereAmount;
      if (!cereAmount) {
        throw new Error(`No CERE amount found for payment ${paymentId}`);
      }

      // Create DDC account if it doesn't exist
      const ddcAccountId = await this.cereBlockchainService.createDDCAccountIfNeeded(cereNetworkAddress);

      // Create a DDC account update record
      const ddcUpdate = await DDCAccountUpdate.create({
        paymentId,
        // @ts-ignore - DDCAccountUpdate model may need interface updating
        teleportTransactionId: teleportTx.id,
        cereNetworkAddress,
        ddcAccountId,
        creditAmount: await this.cereBlockchainService.calculateDDCStorage(cereAmount),
        cereAmount,
        conversionRate: await this.cereBlockchainService.getDDCConversionRate(),
        status: DDCAccountUpdateStatus.PENDING
      });

      // Get the initial balance
      const initialBalance = await this.cereBlockchainService.getAccountBalance(cereNetworkAddress);
      
      // Credit the DDC account
      const { txHash, newBalance } = await this.cereBlockchainService.creditDDCAccount(
        cereNetworkAddress,
        ddcAccountId,
        cereAmount
      );

      // Update the DDC update record with the transaction hash
      await ddcUpdate.update({
        txHash,
        // @ts-ignore - DDCAccountUpdateStatus may need PROCESSING added to enum
        status: DDCAccountUpdateStatus.PENDING
      });

      // Start verification with exponential backoff
      setTimeout(() => {
        this.verifyBalanceUpdate(ddcUpdate.id, initialBalance, cereAmount);
      }, BALANCE_VERIFICATION_DELAY_MS);

    } catch (error: any) {
      logger.error(`Failed to start balance verification for payment ${paymentId}:`, error);
      
      // Update payment status to failed
      try {
        const payment = await Payment.findByPk(paymentId);
        if (payment) {
          await payment.update({
            status: PaymentStatus.FAILED,
            error: `Failed to update DDC balance: ${error.message || 'Unknown error'}`
          });
        }
      } catch (updateError) {
        logger.error(`Failed to update payment status for ${paymentId}:`, updateError);
      }
    }
  }

  /**
   * Verify that the DDC account balance has been updated
   * @param ddcUpdateId The DDC update record ID
   * @param initialBalance The initial balance before the update
   * @param expectedIncrease The expected increase in balance
   * @param retryCount Current retry count
   */
  private async verifyBalanceUpdate(
    ddcUpdateId: string,
    initialBalance: string,
    expectedIncrease: string,
    retryCount: number = 0
  ): Promise<void> {
    try {
      const ddcUpdate = await DDCAccountUpdate.findByPk(ddcUpdateId, {
        include: [{ model: Payment, as: 'payment' }]
      });

      if (!ddcUpdate) {
        logger.error(`DDC update ${ddcUpdateId} not found during verification`);
        return;
      }

      // @ts-ignore - Payment relationship may need defining properly in model
      if (!ddcUpdate.payment) {
        logger.error(`Payment not found for DDC update ${ddcUpdateId}`);
        return;
      }

      // Skip if the update is already completed or failed
      if (
        ddcUpdate.status === DDCAccountUpdateStatus.COMPLETED ||
        ddcUpdate.status === DDCAccountUpdateStatus.FAILED
      ) {
        return;
      }

      // Check transaction status first
      if (ddcUpdate.txHash) {
        const txStatus = await this.cereBlockchainService.checkDDCCreditStatus(ddcUpdate.txHash);
        
        // If failed, mark the update as failed
        if (txStatus === DDCAccountUpdateStatus.FAILED) {
          await this.handleFailedUpdate(ddcUpdate, 'Transaction failed on Cere Network');
          return;
        }
        
        // If completed, verify the balance
        if (txStatus === DDCAccountUpdateStatus.COMPLETED) {
          await this.verifyFinalBalance(ddcUpdate, initialBalance, expectedIncrease);
          return;
        }
      }

      // If we've reached max retries, mark as failed
      if (retryCount >= BALANCE_VERIFICATION_MAX_RETRIES) {
        await this.handleFailedUpdate(ddcUpdate, `Balance verification timed out after ${retryCount} retries`);
        return;
      }

      // Otherwise, schedule another check with exponential backoff
      const nextDelay = BALANCE_VERIFICATION_DELAY_MS * Math.pow(2, retryCount);
      
      logger.info(`Scheduling next balance verification for DDC update ${ddcUpdateId} in ${nextDelay}ms (retry ${retryCount + 1})`);
      
      setTimeout(() => {
        this.verifyBalanceUpdate(ddcUpdateId, initialBalance, expectedIncrease, retryCount + 1);
      }, nextDelay);
    } catch (error: any) {
      logger.error(`Error verifying balance update for ${ddcUpdateId}:`, error);
      
      // Schedule another try if we haven't reached max retries
      if (retryCount < BALANCE_VERIFICATION_MAX_RETRIES) {
        const nextDelay = BALANCE_VERIFICATION_DELAY_MS * Math.pow(2, retryCount);
        
        setTimeout(() => {
          this.verifyBalanceUpdate(ddcUpdateId, initialBalance, expectedIncrease, retryCount + 1);
        }, nextDelay);
      } else {
        // Try to get the DDC update to mark it as failed
        try {
          const ddcUpdate = await DDCAccountUpdate.findByPk(ddcUpdateId, {
            include: [{ model: Payment, as: 'payment' }]
          });
          
          if (ddcUpdate) {
            await this.handleFailedUpdate(ddcUpdate, `Balance verification failed after ${retryCount} retries: ${error.message}`);
          }
        } catch (updateError) {
          logger.error(`Failed to mark DDC update ${ddcUpdateId} as failed:`, updateError);
        }
      }
    }
  }

  /**
   * Compare the current balance with the initial balance and expected increase
   * @param ddcUpdate The DDC update record
   * @param initialBalance The initial balance before the update
   * @param expectedIncrease The expected increase in balance
   */
  private async verifyFinalBalance(
    ddcUpdate: DDCAccountUpdate,
    initialBalance: string,
    expectedIncrease: string
  ): Promise<void> {
    try {
      // Get current balance
      const currentBalance = await this.cereBlockchainService.getAccountBalance(ddcUpdate.cereNetworkAddress);
      
      // Parse balances for comparison
      const initialBalanceValue = ethers.parseUnits(initialBalance, 'ether');
      const expectedIncreaseValue = ethers.parseUnits(expectedIncrease, 'ether');
      const currentBalanceValue = ethers.parseUnits(currentBalance, 'ether');
      
      // Calculate expected balance within an acceptable margin
      const minExpectedBalance = initialBalanceValue + expectedIncreaseValue * BigInt(1 - BALANCE_EXPECTED_INCREASE_MARGIN / 100);
      
      // Check if current balance meets expectations
      if (currentBalanceValue >= minExpectedBalance) {
        logger.info(`Balance verification successful for DDC update ${ddcUpdate.id}`, {
          initialBalance,
          expectedIncrease,
          currentBalance,
          paymentId: ddcUpdate.paymentId
        });
        
        // Mark DDC update as completed
        await ddcUpdate.update({
          status: DDCAccountUpdateStatus.COMPLETED
        });
        
        // Mark payment as completed
        // @ts-ignore - Payment relationship may need defining properly in model
        if (ddcUpdate.payment) {
          // @ts-ignore
          await ddcUpdate.payment.update({
            status: PaymentStatus.COMPLETED,
            completedAt: new Date()
          });
        }
      } else {
        // Balance didn't increase as expected
        await this.handleFailedUpdate(
          ddcUpdate,
          `Balance didn't increase as expected. Initial: ${initialBalance}, Expected increase: ${expectedIncrease}, Current: ${currentBalance}`
        );
      }
    } catch (error: any) {
      logger.error(`Error verifying final balance for DDC update ${ddcUpdate.id}:`, error);
      await this.handleFailedUpdate(ddcUpdate, `Error verifying final balance: ${error.message}`);
    }
  }

  /**
   * Handle a failed update
   * @param ddcUpdate The DDC update record
   * @param reason The reason for the failure
   */
  private async handleFailedUpdate(ddcUpdate: DDCAccountUpdate, reason: string): Promise<void> {
    logger.error(`DDC update ${ddcUpdate.id} failed: ${reason}`, {
      paymentId: ddcUpdate.paymentId,
      txHash: ddcUpdate.txHash
    });
    
    // Mark DDC update as failed
    await ddcUpdate.update({
      status: DDCAccountUpdateStatus.FAILED,
      error: reason
    });
    
    // Mark payment as failed
    // @ts-ignore - Payment relationship may need defining properly in model
    if (ddcUpdate.payment) {
      // @ts-ignore
      await ddcUpdate.payment.update({
        status: PaymentStatus.FAILED,
        error: `DDC balance update failed: ${reason}`
      });
    }
  }

  /**
   * Retry a failed DDC balance update
   * @param ddcUpdateId The DDC update ID to retry
   */
  async retryFailedUpdate(ddcUpdateId: string): Promise<boolean> {
    try {
      const ddcUpdate = await DDCAccountUpdate.findByPk(ddcUpdateId, {
        include: [{ model: Payment, as: 'payment' }]
      });

      if (!ddcUpdate) {
        logger.error(`DDC update ${ddcUpdateId} not found for retry`);
        return false;
      }

      if (ddcUpdate.status !== DDCAccountUpdateStatus.FAILED) {
        logger.warn(`Cannot retry DDC update ${ddcUpdateId}: not in failed state`);
        return false;
      }

      // Get the current balance as our new initial balance
      const initialBalance = await this.cereBlockchainService.getAccountBalance(ddcUpdate.cereNetworkAddress);
      
      // Reset the update status
      await ddcUpdate.update({
        status: DDCAccountUpdateStatus.PENDING,
        error: null
      });
      
      // If payment is in failed state, reset it to updating DDC
      // @ts-ignore - Payment relationship may need defining properly in model
      if (ddcUpdate.payment && ddcUpdate.payment.status === PaymentStatus.FAILED) {
        // @ts-ignore
        await ddcUpdate.payment.update({
          status: PaymentStatus.UPDATING_DDC,
          error: null
        });
      }
      
      // Credit the DDC account again
      const { txHash } = await this.cereBlockchainService.creditDDCAccount(
        ddcUpdate.cereNetworkAddress,
        ddcUpdate.ddcAccountId,
        ddcUpdate.cereAmount
      );
      
      // Update the DDC update record with the new transaction hash
      await ddcUpdate.update({
        txHash,
        status: DDCAccountUpdateStatus.PENDING
      });
      
      // Start verification with exponential backoff
      setTimeout(() => {
        this.verifyBalanceUpdate(ddcUpdate.id, initialBalance, ddcUpdate.cereAmount);
      }, BALANCE_VERIFICATION_DELAY_MS);
      
      return true;
    } catch (error: any) {
      logger.error(`Failed to retry DDC update ${ddcUpdateId}:`, error);
      return false;
    }
  }

  /**
   * Recover pending DDC updates (for service restart)
   */
  async recoverPendingUpdates(): Promise<void> {
    try {
      // Find all DDC updates that are in a non-final state
      const pendingUpdates = await DDCAccountUpdate.findAll({
        where: {
          status: [
            DDCAccountUpdateStatus.PENDING
          ]
        }
      });

      logger.info(`Recovering ${pendingUpdates.length} pending DDC updates`);

      for (const update of pendingUpdates) {
        try {
          // Get the current balance as our initial balance
          const initialBalance = await this.cereBlockchainService.getAccountBalance(update.cereNetworkAddress);
          
          // Start verification
          setTimeout(() => {
            this.verifyBalanceUpdate(update.id, initialBalance, update.cereAmount);
          }, BALANCE_VERIFICATION_DELAY_MS);
          
          logger.info(`Scheduled verification for recovered DDC update ${update.id}`);
        } catch (error) {
          logger.error(`Error recovering DDC update ${update.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error recovering pending DDC updates:', error);
    }
  }
} 