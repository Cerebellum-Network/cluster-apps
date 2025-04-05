import axios from 'axios';
import { 
  CERE_API_URL, 
  CERE_API_KEY 
} from '../config/env';
import logger from '../../utils/logger';
import { DDCAccountUpdateStatus } from '../models';

/**
 * Service to interact with Cere Blockchain API/SDK
 * Implements task #6.2 - Develop Cere Blockchain API/SDK Integration Service
 */
export class CereBlockchainService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    baseUrl: string = CERE_API_URL,
    apiKey: string = CERE_API_KEY
  ) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Creates HTTP headers with authentication
   */
  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-API-Key': this.apiKey
    };
  }

  /**
   * Get account balance on Cere Network
   * @param cereNetworkAddress The Cere Network address
   * @returns Current balance in CERE tokens
   */
  async getAccountBalance(cereNetworkAddress: string): Promise<string> {
    try {
      logger.info(`Getting account balance for ${cereNetworkAddress}`);
      
      const response = await axios.get(
        `${this.baseUrl}/accounts/${cereNetworkAddress}/balance`,
        { headers: this.getHeaders() }
      );

      if (response.status !== 200) {
        throw new Error(`Failed to get account balance: ${response.statusText}`);
      }

      const balance = response.data.balance;
      logger.info(`Account balance for ${cereNetworkAddress}: ${balance} CERE`);
      
      return balance;
    } catch (error) {
      logger.error(`Error getting account balance for ${cereNetworkAddress}:`, error);
      throw error;
    }
  }

  /**
   * Check if an account exists on Cere Network
   * @param cereNetworkAddress The Cere Network address
   * @returns True if the account exists
   */
  async accountExists(cereNetworkAddress: string): Promise<boolean> {
    try {
      logger.info(`Checking if account ${cereNetworkAddress} exists`);
      
      const response = await axios.get(
        `${this.baseUrl}/accounts/${cereNetworkAddress}`,
        { headers: this.getHeaders() }
      );

      return response.status === 200;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return false;
      }
      
      logger.error(`Error checking if account ${cereNetworkAddress} exists:`, error);
      throw error;
    }
  }

  /**
   * Get DDC account details
   * @param ddcAccountId The DDC account ID
   * @returns DDC account details including storage usage and limits
   */
  async getDDCAccountDetails(ddcAccountId: string): Promise<any> {
    try {
      logger.info(`Getting DDC account details for ${ddcAccountId}`);
      
      const response = await axios.get(
        `${this.baseUrl}/ddc/accounts/${ddcAccountId}`,
        { headers: this.getHeaders() }
      );

      if (response.status !== 200) {
        throw new Error(`Failed to get DDC account details: ${response.statusText}`);
      }

      return response.data;
    } catch (error) {
      logger.error(`Error getting DDC account details for ${ddcAccountId}:`, error);
      throw error;
    }
  }

  /**
   * Credit DDC account with additional storage capacity
   * @param cereNetworkAddress The Cere Network address (account to credit)
   * @param ddcAccountId The DDC account ID
   * @param cereAmount The amount of CERE tokens to use
   * @returns Transaction hash and updated balance
   */
  async creditDDCAccount(
    cereNetworkAddress: string, 
    ddcAccountId: string, 
    cereAmount: string
  ): Promise<{ txHash: string; newBalance: string }> {
    try {
      logger.info(`Crediting DDC account ${ddcAccountId} with ${cereAmount} CERE`);
      
      // Check if account exists
      const accountExists = await this.accountExists(cereNetworkAddress);
      if (!accountExists) {
        throw new Error(`Account ${cereNetworkAddress} does not exist on Cere Network`);
      }

      // Send credit transaction
      const response = await axios.post(
        `${this.baseUrl}/ddc/accounts/${ddcAccountId}/credit`,
        {
          amount: cereAmount,
          senderAddress: cereNetworkAddress
        },
        { headers: this.getHeaders() }
      );

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Failed to credit DDC account: ${response.statusText}`);
      }

      const txHash = response.data.txHash;
      const newBalance = response.data.newBalance;

      logger.info(`Successfully credited DDC account ${ddcAccountId} with ${cereAmount} CERE. New balance: ${newBalance}`);
      
      return { txHash, newBalance };
    } catch (error) {
      logger.error(`Error crediting DDC account ${ddcAccountId}:`, error);
      throw error;
    }
  }

  /**
   * Check the status of a DDC account credit transaction
   * @param txHash The transaction hash
   * @returns Status of the transaction (PENDING, COMPLETED, FAILED)
   */
  async checkDDCCreditStatus(txHash: string): Promise<DDCAccountUpdateStatus> {
    try {
      logger.info(`Checking DDC credit transaction status for ${txHash}`);
      
      const response = await axios.get(
        `${this.baseUrl}/transactions/${txHash}`,
        { headers: this.getHeaders() }
      );

      if (response.status !== 200) {
        throw new Error(`Failed to get transaction status: ${response.statusText}`);
      }

      const status = response.data.status;
      
      switch (status) {
        case 'finalized':
        case 'confirmed':
        case 'successful':
          return DDCAccountUpdateStatus.COMPLETED;
        case 'failed':
        case 'rejected':
          return DDCAccountUpdateStatus.FAILED;
        default:
          return DDCAccountUpdateStatus.PENDING;
      }
    } catch (error) {
      logger.error(`Error checking DDC credit status for transaction ${txHash}:`, error);
      throw error;
    }
  }

  /**
   * Convert CERE tokens to DDC storage capacity
   * @param cereAmount Amount of CERE tokens
   * @returns Equivalent amount of DDC storage capacity in GB
   */
  calculateDDCStorage(cereAmount: string): string {
    // This is a simplified calculation - in a real implementation this would
    // likely query a rate from the API or use a more complex formula
    const cereValue = parseFloat(cereAmount);
    
    // Assuming 1 CERE = 10 GB of storage (example conversion rate)
    const storageGB = cereValue * 10;
    
    return storageGB.toString();
  }

  /**
   * Get conversion rate from CERE to DDC storage
   * @returns Current conversion rate (GB per CERE)
   */
  async getDDCConversionRate(): Promise<string> {
    try {
      logger.info('Getting DDC conversion rate');
      
      const response = await axios.get(
        `${this.baseUrl}/ddc/conversion-rate`,
        { headers: this.getHeaders() }
      );

      if (response.status !== 200) {
        throw new Error(`Failed to get DDC conversion rate: ${response.statusText}`);
      }

      return response.data.rate;
    } catch (error) {
      logger.error('Error getting DDC conversion rate:', error);
      
      // Fallback to default conversion rate
      return '10';
    }
  }

  /**
   * Create a new DDC account if it doesn't exist
   * @param cereNetworkAddress The Cere Network address
   * @returns The DDC account ID
   */
  async createDDCAccountIfNeeded(cereNetworkAddress: string): Promise<string> {
    try {
      // First check if DDC account already exists for this address
      const accountExists = await this.accountExists(cereNetworkAddress);
      
      if (accountExists) {
        // If account exists, get its ID
        const accountDetails = await this.getDDCAccountDetails(cereNetworkAddress);
        return accountDetails.ddcAccountId;
      }
      
      logger.info(`Creating new DDC account for ${cereNetworkAddress}`);
      
      // Create new DDC account
      const response = await axios.post(
        `${this.baseUrl}/ddc/accounts`,
        {
          ownerAddress: cereNetworkAddress
        },
        { headers: this.getHeaders() }
      );

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Failed to create DDC account: ${response.statusText}`);
      }

      const ddcAccountId = response.data.ddcAccountId;
      logger.info(`Successfully created DDC account ${ddcAccountId} for ${cereNetworkAddress}`);
      
      return ddcAccountId;
    } catch (error) {
      logger.error(`Error creating DDC account for ${cereNetworkAddress}:`, error);
      throw error;
    }
  }
} 