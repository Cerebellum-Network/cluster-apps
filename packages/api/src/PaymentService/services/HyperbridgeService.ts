import { ethers } from 'ethers';
import { TeleportTransactionStatus } from '../models/types';
import logger from '../../utils/logger';

export class HyperbridgeService {
  constructor(
    private provider: ethers.Provider,
    private hyperbridgeContract: ethers.Contract
  ) {}

  async checkTeleportStatus(teleportTxId: string): Promise<TeleportTransactionStatus> {
    try {
      const status = await this.hyperbridgeContract.getTeleportStatus(teleportTxId);
      switch (status) {
        case 'COMPLETED':
          return TeleportTransactionStatus.COMPLETED;
        case 'FAILED':
          return TeleportTransactionStatus.FAILED;
        default:
          return TeleportTransactionStatus.PENDING;
      }
    } catch (error) {
      logger.error(`Error checking teleport status for ${teleportTxId}:`, error);
      return TeleportTransactionStatus.PENDING;
    }
  }

  async retryTeleport(oldTeleportTxId: string): Promise<string> {
    try {
      // Get the original teleport data
      const teleportData = await this.hyperbridgeContract.getTeleportData(oldTeleportTxId);
      if (!teleportData) {
        throw new Error(`No teleport data found for ${oldTeleportTxId}`);
      }

      // Get the nonce for the next transaction
      const nonce = await this.provider.getTransactionCount(this.provider.getAddress());

      // Create and sign the transaction
      const tx = await this.hyperbridgeContract.retryTeleport(
        oldTeleportTxId,
        teleportData.amount,
        teleportData.recipient,
        { nonce }
      );

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      // Extract the new teleport ID from the event logs
      const teleportEvent = receipt.logs.find(
        log => log.topics[0] === ethers.id('TeleportInitiated(bytes32,address,uint256,address)')
      );

      if (!teleportEvent) {
        throw new Error('Teleport event not found in transaction logs');
      }

      const newTeleportTxId = teleportEvent.topics[1];
      return newTeleportTxId;
    } catch (error) {
      logger.error(`Error retrying teleport for ${oldTeleportTxId}:`, error);
      throw error;
    }
  }
} 