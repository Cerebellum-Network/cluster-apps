import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

// Definir interfaz para los atributos de la transacción de stablecoin
export interface StablecoinTransactionAttributes {
  id: string;
  paymentId: string;
  stablecoinType: string;        // USDC, USDT, etc.
  stablecoinAddress: string;     // Dirección del contrato de stablecoin
  senderAddress: string;         // Dirección del remitente
  amount: string;                // Cantidad en string para manejar números grandes
  blockNumber?: number;          // Número de bloque donde se confirmó
  transactionHash?: string;      // Hash de la transacción
  status: StablecoinTransactionStatus;
  error?: string;                // Mensaje de error si hubo uno
  metadata?: Record<string, any>; // Metadatos adicionales
  createdAt: Date;
  updatedAt: Date;
}

// Estados posibles para una transacción de stablecoin
export enum StablecoinTransactionStatus {
  PENDING = 'PENDING',           // Esperando confirmación
  CONFIRMED = 'CONFIRMED',       // Transacción confirmada
  FAILED = 'FAILED'              // Transacción fallida
}

// Interfaz para creación (algunos campos opcionales al crear)
export interface StablecoinTransactionCreationAttributes extends Optional<StablecoinTransactionAttributes, 
  'id' | 'blockNumber' | 'transactionHash' | 'status' | 'error' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// Definir clase del modelo
class StablecoinTransaction extends Model<StablecoinTransactionAttributes, StablecoinTransactionCreationAttributes> 
  implements StablecoinTransactionAttributes {
  
  public id!: string;
  public paymentId!: string;
  public stablecoinType!: string;
  public stablecoinAddress!: string;
  public senderAddress!: string;
  public amount!: string;
  public blockNumber?: number;
  public transactionHash?: string;
  public status!: StablecoinTransactionStatus;
  public error?: string;
  public metadata?: Record<string, any>;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Métodos adicionales
  public markAsConfirmed(blockNumber: number, transactionHash: string): void {
    this.blockNumber = blockNumber;
    this.transactionHash = transactionHash;
    this.status = StablecoinTransactionStatus.CONFIRMED;
  }
  
  public markAsFailed(error: string): void {
    this.error = error;
    this.status = StablecoinTransactionStatus.FAILED;
  }
}

// Inicializar modelo
StablecoinTransaction.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  stablecoinType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  stablecoinAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  senderAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amount: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  blockNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  transactionHash: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM(...Object.values(StablecoinTransactionStatus)),
    allowNull: false,
    defaultValue: StablecoinTransactionStatus.PENDING,
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
  modelName: 'StablecoinTransaction',
  tableName: 'stablecoin_transactions',
  timestamps: true,
});

export default StablecoinTransaction; 