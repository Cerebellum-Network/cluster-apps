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
import { DexService } from './DexService';
import logger, { logTransaction } from '../../utils/logger';
import { 
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_MS,
  RETRY_BACKOFF_FACTOR 
} from '../../config/env';

export class RetryService {
  constructor(
    private contractService: ContractService,
    private hyperbridgeService: HyperbridgeService,
    private dexService: DexService
  ) {}

  /**
   * Retry a failed payment operation
   */
  async retryFailedOperation(paymentId: string): Promise<boolean> {
    const payment = await Payment.findByPk(paymentId, {
      include: [
        { model: StablecoinTransaction, as: 'stablecoinTransactions' },
        { model: SwapTransaction, as: 'swapTransactions' },
        { model: TeleportTransaction, as: 'teleportTransactions' },
        { model: DDCAccountUpdate, as: 'ddcAccountUpdates' }
      ]
    });

    if (!payment || payment.status !== PaymentStatus.FAILED) {
      logger.warn(`Cannot retry payment ${paymentId}: not found or not failed`);
      return false;
    }

    // Determine which operation failed and retry it
    if (this.hasFailedStablecoinTransaction(payment)) {
      return await this.retryStablecoinTransaction(payment);
    }

    if (this.hasFailedSwapTransaction(payment)) {
      return await this.retrySwapTransaction(payment);
    }

    if (this.hasFailedTeleportTransaction(payment)) {
      return await this.retryTeleportTransaction(payment);
    }

    if (this.hasFailedDDCUpdate(payment)) {
      return await this.retryDDCUpdate(payment);
    }

    logger.warn(`No failed operation found for payment ${paymentId}`);
    return false;
  }

  /**
   * Check if payment has a failed stablecoin transaction
   */
  private hasFailedStablecoinTransaction(payment: Payment): boolean {
    const tx = payment.stablecoinTransactions?.[0];
    return tx?.status === StablecoinTransactionStatus.FAILED;
  }

  /**
   * Check if payment has a failed swap transaction
   */
  private hasFailedSwapTransaction(payment: Payment): boolean {
    const tx = payment.swapTransactions?.[0];
    return tx?.status === SwapTransactionStatus.FAILED;
  }

  /**
   * Check if payment has a failed teleport transaction
   */
  private hasFailedTeleportTransaction(payment: Payment): boolean {
    const tx = payment.teleportTransactions?.[0];
    return tx?.status === TeleportTransactionStatus.FAILED;
  }

  /**
   * Check if payment has a failed DDC update
   */
  private hasFailedDDCUpdate(payment: Payment): boolean {
    const update = payment.ddcAccountUpdates?.[0];
    return update?.status === DDCAccountUpdateStatus.FAILED;
  }

  /**
   * Retry a failed stablecoin transaction with exponential backoff
   */
  private async retryStablecoinTransaction(payment: Payment): Promise<boolean> {
    const tx = payment.stablecoinTransactions?.[0];
    if (!tx) return false;

    let attempt = 1;
    let delay = RETRY_DELAY_MS;

    while (attempt <= MAX_RETRY_ATTEMPTS) {
      try {
        // Wait for the delay before retrying
        await new Promise(resolve => setTimeout(resolve, delay));

        // Attempt to resubmit the transaction
        const newTxHash = await this.contractService.resubmitStablecoinTransaction(
          payment.id,
          payment.amount
        );

        // Update transaction record
        await tx.update({
          transactionHash: newTxHash,
          status: StablecoinTransactionStatus.PENDING,
          error: null
        });

        // Update payment status
        await payment.update({
          status: PaymentStatus.PROCESSING_PAYMENT,
          error: null
        });

        logTransaction(payment.id, 'STABLECOIN_RETRY', 'SUCCESS', {
          attempt,
          newTxHash
        });

        return true;
      } catch (error) {
        logger.error(`Stablecoin retry attempt ${attempt} failed:`, error);
        
        // Increase delay exponentially
        delay *= RETRY_BACKOFF_FACTOR;
        attempt++;

        if (attempt > MAX_RETRY_ATTEMPTS) {
          await tx.update({
            error: `Failed after ${MAX_RETRY_ATTEMPTS} retry attempts`
          });
        }
      }
    }

    return false;
  }

  /**
   * Retry a failed swap transaction with exponential backoff
   */
  private async retrySwapTransaction(payment: Payment): Promise<boolean> {
    const tx = payment.swapTransactions?.[0];
    if (!tx) return false;

    let attempt = 1;
    let delay = RETRY_DELAY_MS;

    while (attempt <= MAX_RETRY_ATTEMPTS) {
      try {
        await new Promise(resolve => setTimeout(resolve, delay));

        // Get latest swap parameters
        const amountIn = ethers.parseUnits(payment.amount, 6); // Assuming USDC/USDT decimals
        const minAmountOut = await this.dexService.getExpectedAmountOut(amountIn);
        
        // Attempt to resubmit the swap
        const newTxHash = await this.dexService.swapExactTokensForTokens(
          amountIn,
          minAmountOut
        );

        await tx.update({
          txHash: newTxHash,
          status: SwapTransactionStatus.PENDING,
          error: null
        });

        await payment.update({
          status: PaymentStatus.SWAPPING_TOKENS,
          error: null
        });

        logTransaction(payment.id, 'SWAP_RETRY', 'SUCCESS', {
          attempt,
          newTxHash
        });

        return true;
      } catch (error) {
        logger.error(`Swap retry attempt ${attempt} failed:`, error);
        
        delay *= RETRY_BACKOFF_FACTOR;
        attempt++;

        if (attempt > MAX_RETRY_ATTEMPTS) {
          await tx.update({
            error: `Failed after ${MAX_RETRY_ATTEMPTS} retry attempts`
          });
        }
      }
    }

    return false;
  }

  /**
   * Retry a failed teleport transaction with exponential backoff
   */
  private async retryTeleportTransaction(payment: Payment): Promise<boolean> {
    const tx = payment.teleportTransactions?.[0];
    if (!tx) return false;

    let attempt = 1;
    let delay = RETRY_DELAY_MS;

    while (attempt <= MAX_RETRY_ATTEMPTS) {
      try {
        await new Promise(resolve => setTimeout(resolve, delay));

        // Attempt to resubmit the teleport
        const newTxId = await this.hyperbridgeService.retryTeleport(
          tx.teleportTxId
        );

        await tx.update({
          teleportTxId: newTxId,
          status: TeleportTransactionStatus.PENDING,
          error: null
        });

        await payment.update({
          status: PaymentStatus.TELEPORT_INITIATED,
          error: null
        });

        logTransaction(payment.id, 'TELEPORT_RETRY', 'SUCCESS', {
          attempt,
          newTxId
        });

        return true;
      } catch (error) {
        logger.error(`Teleport retry attempt ${attempt} failed:`, error);
        
        delay *= RETRY_BACKOFF_FACTOR;
        attempt++;

        if (attempt > MAX_RETRY_ATTEMPTS) {
          await tx.update({
            error: `Failed after ${MAX_RETRY_ATTEMPTS} retry attempts`
          });
        }
      }
    }

    return false;
  }

  /**
   * Retry a failed DDC account update with exponential backoff
   */
  private async retryDDCUpdate(payment: Payment): Promise<boolean> {
    const update = payment.ddcAccountUpdates?.[0];
    if (!update) return false;

    let attempt = 1;
    let delay = RETRY_DELAY_MS;

    while (attempt <= MAX_RETRY_ATTEMPTS) {
      try {
        await new Promise(resolve => setTimeout(resolve, delay));

        // Attempt to resubmit the DDC update
        const newTxHash = await this.contractService.retryDDCUpdate(
          payment.id,
          payment.amount
        );

        await update.update({
          txHash: newTxHash,
          status: DDCAccountUpdateStatus.PENDING,
          error: null
        });

        await payment.update({
          status: PaymentStatus.UPDATING_DDC,
          error: null
        });

        logTransaction(payment.id, 'DDC_UPDATE_RETRY', 'SUCCESS', {
          attempt,
          newTxHash
        });

        return true;
      } catch (error) {
        logger.error(`DDC update retry attempt ${attempt} failed:`, error);
        
        delay *= RETRY_BACKOFF_FACTOR;
        attempt++;

        if (attempt > MAX_RETRY_ATTEMPTS) {
          await update.update({
            error: `Failed after ${MAX_RETRY_ATTEMPTS} retry attempts`
          });
        }
      }
    }

    return false;
  }
} 