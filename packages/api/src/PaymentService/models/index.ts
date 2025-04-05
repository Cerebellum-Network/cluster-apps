import { Model, DataTypes, Sequelize } from 'sequelize';
import {
  Payment as IPayment,
  PaymentStatus,
  StablecoinTransaction as IStablecoinTransaction,
  StablecoinTransactionStatus,
  SwapTransaction as ISwapTransaction,
  SwapTransactionStatus,
  TeleportTransaction as ITeleportTransaction,
  TeleportTransactionStatus,
  DDCAccountUpdate as IDDCAccountUpdate,
  DDCAccountUpdateStatus
} from './types';
import User, { UserRole } from './User';
import sequelize from '../config/database';

// Export all models
export {
  Payment,
  PaymentStatus,
  User,
  UserRole,
  StablecoinTransaction,
  StablecoinTransactionStatus,
  SwapTransaction,
  SwapTransactionStatus,
  TeleportTransaction,
  TeleportTransactionStatus,
  DDCAccountUpdate,
  DDCAccountUpdateStatus
};

// Export enums together for easier usage
export const Enums = {
  PaymentStatus,
  UserRole,
  StablecoinTransactionStatus,
  SwapTransactionStatus,
  TeleportTransactionStatus,
  DDCAccountUpdateStatus
};

// Function to synchronize models with the database
export const syncModels = async (force = false): Promise<void> => {
  try {
    // Define model associations before sync
    
    // Payment associations
    Payment.hasMany(StablecoinTransaction, { foreignKey: 'paymentId', as: 'stablecoinTransactions' });
    Payment.hasMany(SwapTransaction, { foreignKey: 'paymentId', as: 'swapTransactions' });
    Payment.hasMany(TeleportTransaction, { foreignKey: 'paymentId', as: 'teleportTransactions' });
    Payment.hasMany(DDCAccountUpdate, { foreignKey: 'paymentId', as: 'ddcAccountUpdates' });
    
    // User associations
    User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });
    
    // Transaction associations
    StablecoinTransaction.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });
    SwapTransaction.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });
    TeleportTransaction.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });
    DDCAccountUpdate.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });
    
    // DDC account updates have a reference to teleport transactions
    DDCAccountUpdate.belongsTo(TeleportTransaction, { foreignKey: 'teleportTransactionId', as: 'teleportTransaction' });
    TeleportTransaction.hasMany(DDCAccountUpdate, { foreignKey: 'teleportTransactionId', as: 'ddcAccountUpdates' });
    
    // Sync all models with the database
    // The force parameter determines whether existing tables are dropped and recreated
    await sequelize.sync({ force });
    
    console.log('Database models synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing database models:', error);
    throw error;
  }
};

export class Payment extends Model<IPayment> implements IPayment {
  public id!: string;
  public userId!: string;
  public status!: PaymentStatus;
  public amount!: string;
  public error?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public stablecoinTransactions?: StablecoinTransaction[];
  public swapTransactions?: SwapTransaction[];
  public teleportTransactions?: TeleportTransaction[];
  public ddcAccountUpdates?: DDCAccountUpdate[];
}

export class StablecoinTransaction extends Model<IStablecoinTransaction> implements IStablecoinTransaction {
  public id!: string;
  public paymentId!: string;
  public transactionHash!: string;
  public status!: StablecoinTransactionStatus;
  public blockNumber?: number;
  public error?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export class SwapTransaction extends Model<ISwapTransaction> implements ISwapTransaction {
  public id!: string;
  public paymentId!: string;
  public txHash!: string;
  public status!: SwapTransactionStatus;
  public blockNumber?: number;
  public error?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export class TeleportTransaction extends Model<ITeleportTransaction> implements ITeleportTransaction {
  public id!: string;
  public paymentId!: string;
  public teleportTxId!: string;
  public status!: TeleportTransactionStatus;
  public confirmedAt?: Date;
  public error?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export class DDCAccountUpdate extends Model<IDDCAccountUpdate> implements IDDCAccountUpdate {
  public id!: string;
  public paymentId!: string;
  public txHash!: string;
  public status!: DDCAccountUpdateStatus;
  public error?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initModels(sequelize: Sequelize): void {
  Payment.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PaymentStatus)),
      allowNull: false
    },
    amount: {
      type: DataTypes.STRING,
      allowNull: false
    },
    error: {
      type: DataTypes.STRING
    }
  }, {
    sequelize,
    tableName: 'payments'
  });

  StablecoinTransaction.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    paymentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'payments',
        key: 'id'
      }
    },
    transactionHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(...Object.values(StablecoinTransactionStatus)),
      allowNull: false
    },
    blockNumber: {
      type: DataTypes.INTEGER
    },
    error: {
      type: DataTypes.STRING
    }
  }, {
    sequelize,
    tableName: 'stablecoin_transactions'
  });

  SwapTransaction.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    paymentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'payments',
        key: 'id'
      }
    },
    txHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(...Object.values(SwapTransactionStatus)),
      allowNull: false
    },
    blockNumber: {
      type: DataTypes.INTEGER
    },
    error: {
      type: DataTypes.STRING
    }
  }, {
    sequelize,
    tableName: 'swap_transactions'
  });

  TeleportTransaction.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    paymentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'payments',
        key: 'id'
      }
    },
    teleportTxId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(...Object.values(TeleportTransactionStatus)),
      allowNull: false
    },
    confirmedAt: {
      type: DataTypes.DATE
    },
    error: {
      type: DataTypes.STRING
    }
  }, {
    sequelize,
    tableName: 'teleport_transactions'
  });

  DDCAccountUpdate.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    paymentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'payments',
        key: 'id'
      }
    },
    txHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(...Object.values(DDCAccountUpdateStatus)),
      allowNull: false
    },
    error: {
      type: DataTypes.STRING
    }
  }, {
    sequelize,
    tableName: 'ddc_account_updates'
  });

  // Set up associations
  Payment.hasMany(StablecoinTransaction, {
    foreignKey: 'paymentId',
    as: 'stablecoinTransactions'
  });
  StablecoinTransaction.belongsTo(Payment, {
    foreignKey: 'paymentId'
  });

  Payment.hasMany(SwapTransaction, {
    foreignKey: 'paymentId',
    as: 'swapTransactions'
  });
  SwapTransaction.belongsTo(Payment, {
    foreignKey: 'paymentId'
  });

  Payment.hasMany(TeleportTransaction, {
    foreignKey: 'paymentId',
    as: 'teleportTransactions'
  });
  TeleportTransaction.belongsTo(Payment, {
    foreignKey: 'paymentId'
  });

  Payment.hasMany(DDCAccountUpdate, {
    foreignKey: 'paymentId',
    as: 'ddcAccountUpdates'
  });
  DDCAccountUpdate.belongsTo(Payment, {
    foreignKey: 'paymentId'
  });
} 