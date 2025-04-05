import { ethers } from 'ethers';
import logger from '../../utils/logger';
import { 
  GAS_PRICE_MULTIPLIER,
  MAX_GAS_PRICE,
  MIN_CONFIRMATIONS,
  GAS_ESTIMATION_BUFFER
} from '../../config/env';

interface GasStrategy {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  gasLimit: bigint;
}

export class GasOptimizer {
  constructor(private provider: ethers.JsonRpcProvider) {}

  /**
   * Calculate optimal gas strategy based on current network conditions
   */
  async calculateGasStrategy(
    estimatedGas: bigint,
    isHighPriority: boolean = false
  ): Promise<GasStrategy> {
    try {
      // Get current network conditions
      const [feeData, block] = await Promise.all([
        this.provider.getFeeData(),
        this.provider.getBlock('latest')
      ]);

      if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas || !block) {
        throw new Error('Failed to get network fee data');
      }

      // Calculate base fee with multiplier
      const multiplier = isHighPriority ? GAS_PRICE_MULTIPLIER * 12n / 10n : GAS_PRICE_MULTIPLIER;
      let maxFeePerGas = (feeData.maxFeePerGas * multiplier) / 100n;
      let maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * multiplier) / 100n;

      // Cap gas prices at maximum allowed
      maxFeePerGas = maxFeePerGas > MAX_GAS_PRICE ? MAX_GAS_PRICE : maxFeePerGas;
      maxPriorityFeePerGas = maxPriorityFeePerGas > MAX_GAS_PRICE ? MAX_GAS_PRICE : maxPriorityFeePerGas;

      // Add buffer to estimated gas limit
      const gasLimit = (estimatedGas * GAS_ESTIMATION_BUFFER) / 100n;

      return {
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit
      };
    } catch (error) {
      logger.error('Error calculating gas strategy:', error);
      throw error;
    }
  }

  /**
   * Wait for sufficient confirmations with adaptive timeout
   */
  async waitForConfirmations(
    txHash: string,
    minConfirmations: number = MIN_CONFIRMATIONS
  ): Promise<ethers.TransactionReceipt> {
    try {
      // Get initial receipt
      let receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      // Wait for minimum confirmations
      while (Number(receipt.confirmations) < minConfirmations) {
        // Calculate adaptive wait time based on network congestion
        const block = await this.provider.getBlock('latest');
        if (!block) {
          throw new Error('Failed to get latest block');
        }

        const baseWaitTime = 1000; // 1 second base wait time
        const congestionFactor = Number(block.gasUsed) / Number(block.gasLimit);
        const waitTime = Math.floor(baseWaitTime * (1 + congestionFactor));

        await new Promise(resolve => setTimeout(resolve, waitTime));
        receipt = await this.provider.getTransactionReceipt(txHash);
        
        if (!receipt) {
          throw new Error('Transaction receipt not found during confirmation wait');
        }
      }

      return receipt;
    } catch (error) {
      logger.error(`Error waiting for confirmations for tx ${txHash}:`, error);
      throw error;
    }
  }

  /**
   * Estimate gas for a transaction with safety buffer
   */
  async estimateGasWithBuffer(
    contract: ethers.Contract,
    method: string,
    args: any[]
  ): Promise<bigint> {
    try {
      // Use the contract's interface to get the function
      const contractFunction = contract.interface.getFunction(method);
      if (!contractFunction) {
        throw new Error(`Method ${method} not found in contract interface`);
      }

      // Estimate gas using the function fragment
      const data = contract.interface.encodeFunctionData(contractFunction, args);
      const estimatedGas = await this.provider.estimateGas({
        to: contract.getAddress(),
        data
      });

      return (estimatedGas * GAS_ESTIMATION_BUFFER) / 100n;
    } catch (error) {
      logger.error(`Error estimating gas for method ${method}:`, error);
      throw error;
    }
  }

  /**
   * Check if transaction can be replaced with higher gas price
   */
  async canReplaceTransaction(
    txHash: string,
    newGasPrice: bigint
  ): Promise<boolean> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx || !tx.maxFeePerGas) {
        return false;
      }

      // Check if new gas price is at least 10% higher than original
      const minIncrease = (tx.maxFeePerGas * 110n) / 100n;
      return newGasPrice >= minIncrease;
    } catch (error) {
      logger.error(`Error checking if transaction ${txHash} can be replaced:`, error);
      return false;
    }
  }

  /**
   * Get optimal batch size for multiple transactions
   */
  async getOptimalBatchSize(
    estimatedGasPerTx: bigint,
    maxTotalGas: bigint = 30000000n // Block gas limit on most networks
  ): Promise<number> {
    try {
      const block = await this.provider.getBlock('latest');
      if (!block) {
        throw new Error('Failed to get latest block');
      }

      // Calculate optimal batch size based on current block gas limit
      const blockGasLimit = block.gasLimit;
      const targetGasLimit = (blockGasLimit * 80n) / 100n; // Target 80% of block gas limit
      const batchSize = Number(targetGasLimit / estimatedGasPerTx);

      // Cap batch size based on maxTotalGas
      const maxBatchSize = Number(maxTotalGas / estimatedGasPerTx);
      return Math.min(batchSize, maxBatchSize);
    } catch (error) {
      logger.error('Error calculating optimal batch size:', error);
      throw error;
    }
  }
} 