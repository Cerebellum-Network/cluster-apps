import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

// Define interface for teleport transaction attributes
export interface TeleportTransactionAttributes {
  id: string;
  paymentId: string;
  cereAmount: string;               // Amount of CERE tokens being teleported
  senderAddress: string;            // EVM sender address
  cereNetworkAddress: string;       // Destination address on Cere Network
  teleportTxId?: string;            // Hyperbridge teleport transaction ID
  evmTransactionHash?: string;      // EVM transaction hash
  status: TeleportTransactionStatus;
  error?: string;                   // Error message if any
  confirmedAt?: Date;               // When the teleport was confirmed on Cere Network
  metadata?: Record<string, any>;   // Additional metadata
  createdAt: Date;
  updatedAt: Date;
}

// Possible states for a teleport transaction
export enum TeleportTransactionStatus {
  PENDING = 'PENDING',              // Waiting to be sent
  INITIATED = 'INITIATED',          // Teleport transaction sent to Hyperbridge
  PROCESSING = 'PROCESSING',        // Being processed by Hyperbridge
  COMPLETED = 'COMPLETED',          // Successfully teleported to Cere Network
  FAILED = 'FAILED'                 // Teleport failed
}

// Interface for creation (some fields are optional when creating)
export interface TeleportTransactionCreationAttributes extends Optional<TeleportTransactionAttributes, 
  'id' | 'teleportTxId' | 'evmTransactionHash' | 'status' | 'error' | 'confirmedAt' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// Define model class
class TeleportTransaction extends Model<TeleportTransactionAttributes, TeleportTransactionCreationAttributes> 
  implements TeleportTransactionAttributes {
  
  public id!: string;
  public paymentId!: string;
  public cereAmount!: string;
  public senderAddress!: string;
  public cereNetworkAddress!: string;
  public teleportTxId?: string;
  public evmTransactionHash?: string;
  public status!: TeleportTransactionStatus;
  public error?: string;
  public confirmedAt?: Date;
  public metadata?: Record<string, any>;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Additional methods
  public markAsInitiated(evmTransactionHash: string, teleportTxId: string): void {
    this.evmTransactionHash = evmTransactionHash;
    this.teleportTxId = teleportTxId;
    this.status = TeleportTransactionStatus.INITIATED;
  }
  
  public markAsProcessing(): void {
    this.status = TeleportTransactionStatus.PROCESSING;
  }
  
  public markAsCompleted(): void {
    this.status = TeleportTransactionStatus.COMPLETED;
    this.confirmedAt = new Date();
  }
  
  public markAsFailed(error: string): void {
    this.error = error;
    this.status = TeleportTransactionStatus.FAILED;
  }
}

// Initialize model
TeleportTransaction.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cereAmount: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  senderAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cereNetworkAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  teleportTxId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  evmTransactionHash: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM(...Object.values(TeleportTransactionStatus)),
    allowNull: false,
    defaultValue: TeleportTransactionStatus.PENDING,
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  confirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'TeleportTransaction',
  tableName: 'teleport_transactions',
  timestamps: true,
});

export default TeleportTransaction; 