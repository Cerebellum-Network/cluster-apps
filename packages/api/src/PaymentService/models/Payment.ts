import { 
  Model, DataTypes, Optional, Sequelize
} from 'sequelize';
import sequelize from '../config/database';

// Define interface for payment attributes
export interface PaymentAttributes {
  id: string;
  userId: string;
  externalId?: string;              // External reference ID (e.g., Stripe payment ID)
  stablecoinAddress: string;        // Stablecoin contract address
  stablecoinAmount: string;         // Amount in stablecoin
  cereAmount?: string;              // Amount in CERE tokens after swap
  cereNetworkAddress: string;       // Destination address on Cere Network
  ddcAccountId?: string;            // DDC account ID to credit
  paymentId: string;                // Unique identifier for blockchain transaction tracking
  teleportTxId?: string;            // Hyperbridge teleport transaction ID
  status: PaymentStatus;            // Current status of the payment process
  provider: PaymentProvider;        // Payment provider
  errorStep?: string;               // Step where an error occurred, if any
  errorMessage?: string;            // Error message if payment failed
  completedAt?: Date;               // When the payment process was completed
  metadata?: Record<string, any>;   // Additional information
  createdAt: Date;
  updatedAt: Date;
}

// Possible states of the payment process
export enum PaymentStatus {
  INITIATED = 'INITIATED',          // Payment process started
  PROCESSING_PAYMENT = 'PROCESSING_PAYMENT',  // Processing stablecoin payment
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',      // Stablecoin payment received
  SWAPPING_TOKENS = 'SWAPPING_TOKENS',        // Converting stablecoins to CERE
  TOKENS_SWAPPED = 'TOKENS_SWAPPED',          // Swap to CERE completed
  TELEPORTING = 'TELEPORTING',                // Teleporting CERE to Cere Network
  TELEPORT_INITIATED = 'TELEPORT_INITIATED',  // Teleport transaction initiated
  TELEPORTED = 'TELEPORTED',                  // CERE tokens teleported successfully
  TELEPORT_CONFIRMED = 'TELEPORT_CONFIRMED',  // Teleport confirmed on destination chain
  UPDATING_DDC = 'UPDATING_DDC',              // Updating DDC account balance
  COMPLETED = 'COMPLETED',                    // Entire process completed successfully
  FAILED = 'FAILED'                           // Failed at some step
}

// Payment providers
export enum PaymentProvider {
  DIRECT = 'DIRECT',                // Direct stablecoin payment
  STRIPE = 'STRIPE',                // Payment through Stripe
  RAMP = 'RAMP',                    // Payment through Ramp
  OTHER = 'OTHER'                   // Other provider
}

// Interface for creation (some fields are optional when creating)
export interface PaymentCreationAttributes extends Optional<PaymentAttributes, 
  'id' | 'externalId' | 'cereAmount' | 'ddcAccountId' | 'teleportTxId' | 'status' | 
  'errorStep' | 'errorMessage' | 'completedAt' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// Define model class
class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
  public id!: string;
  public userId!: string;
  public externalId?: string;
  public stablecoinAddress!: string;
  public stablecoinAmount!: string;
  public cereAmount?: string;
  public cereNetworkAddress!: string;
  public ddcAccountId?: string;
  public paymentId!: string;
  public teleportTxId?: string;
  public status!: PaymentStatus;
  public provider!: PaymentProvider;
  public errorStep?: string;
  public errorMessage?: string;
  public completedAt?: Date;
  public metadata?: Record<string, any>;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Additional methods for status updates
  public updateStatus(newStatus: PaymentStatus, additionalData: Record<string, any> = {}): void {
    this.status = newStatus;
    
    // Update additional fields based on status
    if (newStatus === PaymentStatus.COMPLETED) {
      this.completedAt = new Date();
    } else if (newStatus === PaymentStatus.TOKENS_SWAPPED && additionalData.cereAmount) {
      this.cereAmount = additionalData.cereAmount;
    } else if ((newStatus === PaymentStatus.TELEPORT_INITIATED || newStatus === PaymentStatus.TELEPORTING) && additionalData.teleportTxId) {
      this.teleportTxId = additionalData.teleportTxId;
    } else if (newStatus === PaymentStatus.COMPLETED && additionalData.ddcAccountId) {
      this.ddcAccountId = additionalData.ddcAccountId;
    }
    
    // Update metadata with additional data
    if (Object.keys(additionalData).length > 0) {
      this.metadata = {
        ...this.metadata,
        ...additionalData,
        statusUpdates: [
          ...(this.metadata?.statusUpdates || []),
          {
            status: newStatus,
            timestamp: new Date().toISOString(),
            data: additionalData
          }
        ]
      };
    }
  }
  
  public markAsFailed(step: string, error: string): void {
    this.status = PaymentStatus.FAILED;
    this.errorStep = step;
    this.errorMessage = error;
    
    // Update metadata with error details
    this.metadata = {
      ...this.metadata,
      error: {
        step,
        message: error,
        timestamp: new Date().toISOString()
      },
      statusUpdates: [
        ...(this.metadata?.statusUpdates || []),
        {
          status: PaymentStatus.FAILED,
          timestamp: new Date().toISOString(),
          data: { step, error }
        }
      ]
    };
  }
  
  // Get estimated time remaining based on current status
  public getEstimatedTimeRemaining(): number {
    // Average times in seconds for each step
    const stepTimes: Record<PaymentStatus, number> = {
      [PaymentStatus.INITIATED]: 300,             // 5 minutes from start to finish
      [PaymentStatus.PROCESSING_PAYMENT]: 240,    // 4 minutes remaining
      [PaymentStatus.PAYMENT_RECEIVED]: 210,      // 3.5 minutes remaining
      [PaymentStatus.SWAPPING_TOKENS]: 180,       // 3 minutes remaining
      [PaymentStatus.TOKENS_SWAPPED]: 120,        // 2 minutes remaining
      [PaymentStatus.TELEPORTING]: 90,            // 1.5 minutes remaining
      [PaymentStatus.TELEPORT_INITIATED]: 75,     // 1.25 minutes remaining
      [PaymentStatus.TELEPORTED]: 60,             // 1 minute remaining
      [PaymentStatus.TELEPORT_CONFIRMED]: 45,     // 45 seconds remaining
      [PaymentStatus.UPDATING_DDC]: 30,           // 30 seconds remaining
      [PaymentStatus.COMPLETED]: 0,               // Completed
      [PaymentStatus.FAILED]: 0                   // Failed
    };
    
    return stepTimes[this.status] || 0;
  }
}

// Initialize model
Payment.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  externalId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  stablecoinAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  stablecoinAmount: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cereAmount: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  cereNetworkAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ddcAccountId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  teleportTxId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM(...Object.values(PaymentStatus)),
    allowNull: false,
    defaultValue: PaymentStatus.INITIATED,
  },
  provider: {
    type: DataTypes.ENUM(...Object.values(PaymentProvider)),
    allowNull: false,
    defaultValue: PaymentProvider.DIRECT,
  },
  errorStep: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  completedAt: {
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
  modelName: 'Payment',
  tableName: 'payments',
  timestamps: true,
  indexes: [
    {
      name: 'payment_user_id_idx',
      fields: ['userId']
    },
    {
      name: 'payment_status_idx',
      fields: ['status']
    },
    {
      name: 'payment_external_id_idx',
      fields: ['externalId']
    },
    {
      name: 'payment_payment_id_idx',
      unique: true,
      fields: ['paymentId']
    }
  ]
});

export default Payment; 