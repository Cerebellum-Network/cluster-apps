import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

// Define interface for DDC account update attributes
export interface DDCAccountUpdateAttributes {
  id: string;
  paymentId: string;
  teleportTransactionId: string;     // Related teleport transaction
  cereNetworkAddress: string;        // Cere Network address
  ddcAccountId: string;              // DDC account identifier 
  creditAmount: string;              // Amount of DDC credits added
  cereAmount: string;                // Amount of CERE tokens used
  conversionRate: string;            // Conversion rate from CERE to DDC credits
  status: DDCAccountUpdateStatus;
  txHash?: string;                   // Transaction hash on Cere Network
  error?: string;                    // Error message if any
  metadata?: Record<string, any>;    // Additional metadata
  createdAt: Date;
  updatedAt: Date;
}

// Possible states for a DDC account update
export enum DDCAccountUpdateStatus {
  PENDING = 'PENDING',               // Waiting to be processed
  PROCESSING = 'PROCESSING',         // Being processed
  COMPLETED = 'COMPLETED',           // Successfully updated
  FAILED = 'FAILED'                  // Update failed
}

// Interface for creation (some fields are optional when creating)
export interface DDCAccountUpdateCreationAttributes extends Optional<DDCAccountUpdateAttributes, 
  'id' | 'status' | 'txHash' | 'error' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// Define model class
class DDCAccountUpdate extends Model<DDCAccountUpdateAttributes, DDCAccountUpdateCreationAttributes> 
  implements DDCAccountUpdateAttributes {
  
  public id!: string;
  public paymentId!: string;
  public teleportTransactionId!: string;
  public cereNetworkAddress!: string;
  public ddcAccountId!: string;
  public creditAmount!: string;
  public cereAmount!: string;
  public conversionRate!: string;
  public status!: DDCAccountUpdateStatus;
  public txHash?: string;
  public error?: string;
  public metadata?: Record<string, any>;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Additional methods
  public markAsProcessing(): void {
    this.status = DDCAccountUpdateStatus.PROCESSING;
  }
  
  public markAsCompleted(txHash: string): void {
    this.txHash = txHash;
    this.status = DDCAccountUpdateStatus.COMPLETED;
  }
  
  public markAsFailed(error: string): void {
    this.error = error;
    this.status = DDCAccountUpdateStatus.FAILED;
  }
  
  // Calculate equivalent USD value based on provided USD/CERE rate
  public getUSDValue(usdCereRate: number): number {
    const cereAmount = parseFloat(this.cereAmount);
    return cereAmount * usdCereRate;
  }
}

// Initialize model
DDCAccountUpdate.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  teleportTransactionId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cereNetworkAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ddcAccountId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  creditAmount: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cereAmount: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  conversionRate: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM(...Object.values(DDCAccountUpdateStatus)),
    allowNull: false,
    defaultValue: DDCAccountUpdateStatus.PENDING,
  },
  txHash: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  error: {
    type: DataTypes.TEXT,
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
  modelName: 'DDCAccountUpdate',
  tableName: 'ddc_account_updates',
  timestamps: true,
});

export default DDCAccountUpdate; 