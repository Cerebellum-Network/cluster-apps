import { ethers, Log } from 'ethers';
import { 
  CONTRACT_HYPERBRIDGE_ADDRESS,
  CONTRACT_NETWORK_RPC_URL,
  CERE_TOKEN_ADDRESS
} from '../../config/env';
import { logger } from '../../utils/logger';
import { TeleportTransactionStatus } from '../../models/TeleportTransaction';
import { IHyperbridgeTeleport, IERC20 } from '../../types/contracts';

const HYPERBRIDGE_ABI = [
  'function teleportToCereNetwork(uint256 amount, string calldata cereNetworkAddress) external returns (bytes32)',
  'function checkTeleportStatus(bytes32 txId) external view returns (uint8)',
  'function getCereTokenAddress() external view returns (address)',
  'event TeleportInitiated(bytes32 indexed txId, address indexed fromAddress, string cereNetworkAddress, uint256 amount, uint256 timestamp)',
  'event TeleportStatusUpdated(bytes32 indexed txId, uint8 status)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)'
];

export class HyperbridgeService {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private hyperbridgeContract?: ethers.Contract & IHyperbridgeTeleport;

  constructor(provider?: ethers.Provider, signer?: ethers.Signer) {
    this.provider = provider || new ethers.JsonRpcProvider(CONTRACT_NETWORK_RPC_URL);
    this.signer = signer;
    this.initializeContracts();
  }

  private initializeContracts() {
    this.hyperbridgeContract = new ethers.Contract(
      CONTRACT_HYPERBRIDGE_ADDRESS,
      HYPERBRIDGE_ABI,
      this.provider
    ) as ethers.Contract & IHyperbridgeTeleport;
  }

  /**
   * Sets the signer for transactions
   * @param signer Ethers signer
   */
  public setSigner(signer: ethers.Signer) {
    this.signer = signer;
    this.initializeContracts();
  }

  /**
   * Teleports CERE tokens to the Cere Network
   * @param amount Amount of CERE tokens to teleport (in base units)
   * @param cereNetworkAddress Destination address on Cere Network
   * @returns Transaction ID for the teleportation
   */
  public async teleportToCereNetwork(
    amount: bigint,
    cereNetworkAddress: string
  ): Promise<string> {
    try {
      if (!this.signer) {
        throw new Error('No signer available for transactions');
      }

      if (!this.hyperbridgeContract) {
        throw new Error('Hyperbridge contract not initialized');
      }

      // Connect to contracts with signer
      const hyperbridgeWithSigner = this.hyperbridgeContract.connect(this.signer) as IHyperbridgeTeleport;
      const cereToken = new ethers.Contract(CERE_TOKEN_ADDRESS, ERC20_ABI, this.provider) as ethers.Contract & IERC20;
      const cereTokenWithSigner = cereToken.connect(this.signer) as IERC20;

      // Check CERE token balance
      const balance = await cereToken.balanceOf(await this.signer.getAddress());
      if (ethers.toBigInt(balance) < amount) {
        throw new Error(`Insufficient CERE token balance. Required: ${amount}, Available: ${balance}`);
      }

      // Check and set allowance if needed
      const allowance = await cereToken.allowance(await this.signer.getAddress(), CONTRACT_HYPERBRIDGE_ADDRESS);
      if (ethers.toBigInt(allowance) < amount) {
        logger.info(`Approving ${amount} CERE tokens for Hyperbridge contract`);
        const approveTx = await cereTokenWithSigner.approve(CONTRACT_HYPERBRIDGE_ADDRESS, amount);
        const approveReceipt = await approveTx.wait();
        if (!approveReceipt) {
          throw new Error('Failed to get approval transaction receipt');
        }
        logger.info(`Approval transaction confirmed: ${approveTx.hash}`);
      }

      // Teleport tokens
      logger.info(`Teleporting ${amount} CERE tokens to ${cereNetworkAddress}`);
      const tx = await hyperbridgeWithSigner.teleportToCereNetwork(amount, cereNetworkAddress);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Failed to get teleport transaction receipt');
      }

      // Get teleport ID from event
      const teleportEvent = receipt.logs
        .map((log: Log) => {
          try {
            const parsedLog = this.hyperbridgeContract!.interface.parseLog({
              topics: [...log.topics],
              data: log.data
            });
            return parsedLog;
          } catch {
            return null;
          }
        })
        .find(log => log?.name === 'TeleportInitiated');

      if (!teleportEvent) {
        throw new Error('TeleportInitiated event not found in transaction logs');
      }

      const teleportTxId = teleportEvent.args[0];
      logger.info(`Teleport initiated with ID: ${teleportTxId}`);

      return teleportTxId;
    } catch (error) {
      logger.error('Failed to teleport tokens:', error);
      throw error;
    }
  }

  /**
   * Checks the status of a teleportation transaction
   * @param txId Teleportation transaction ID
   * @returns Current status of the teleportation
   */
  public async checkTeleportStatus(txId: string): Promise<TeleportTransactionStatus> {
    try {
      if (!this.hyperbridgeContract) {
        throw new Error('Hyperbridge contract not initialized');
      }

      const status = await this.hyperbridgeContract.checkTeleportStatus(txId);
      
      // Map contract status to our enum
      // Contract: 0: Not Exists, 1: Pending, 2: Completed, 3: Failed
      switch (status) {
        case 0:
          return TeleportTransactionStatus.PENDING;
        case 1:
          return TeleportTransactionStatus.PROCESSING;
        case 2:
          return TeleportTransactionStatus.COMPLETED;
        case 3:
          return TeleportTransactionStatus.FAILED;
        default:
          return TeleportTransactionStatus.PENDING;
      }
    } catch (error) {
      logger.error('Failed to check teleport status:', error);
      throw error;
    }
  }

  /**
   * Gets the CERE token address used by the Hyperbridge
   * @returns Address of the CERE token contract
   */
  public async getCereTokenAddress(): Promise<string> {
    if (!this.hyperbridgeContract) {
      throw new Error('Hyperbridge contract not initialized');
    }
    return await this.hyperbridgeContract.getCereTokenAddress();
  }
} 