export enum TeleportTransactionStatus {
  PENDING = 'PENDING',              // Initial state, not yet sent to Hyperbridge
  INITIATED = 'INITIATED',          // Transaction sent to Hyperbridge
  PROCESSING = 'PROCESSING',        // Being processed by Hyperbridge
  COMPLETED = 'COMPLETED',          // Successfully teleported to Cere Network
  FAILED = 'FAILED'                 // Teleport failed
}

export interface TeleportTransaction {
  id: string;                       // Unique identifier
  paymentId?: string;              // Associated payment ID if part of a payment flow
  cereAmount: string;              // Amount of CERE tokens being teleported
  senderAddress: string;           // EVM sender address
  cereNetworkAddress: string;      // Destination address on Cere Network
  teleportTxId: string;            // Hyperbridge teleport transaction ID
  evmTransactionHash?: string;     // EVM transaction hash
  status: TeleportTransactionStatus;
  error?: string;                  // Error message if any
  confirmedAt?: Date;              // When the teleport was confirmed on Cere Network
  metadata?: Record<string, any>;  // Additional metadata
  createdAt: Date;
  updatedAt: Date;
} 