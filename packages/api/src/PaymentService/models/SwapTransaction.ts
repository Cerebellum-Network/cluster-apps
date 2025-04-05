import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

// Definir interfaz para los atributos de la transacción de swap
export interface SwapTransactionAttributes {
  id: string;
  paymentId: string;
  tokenInAddress: string;          // Dirección del token de entrada (stablecoin)
  tokenOutAddress: string;         // Dirección del token de salida (CERE)
  amountIn: string;                // Cantidad de tokens de entrada
  amountOutMin: string;            // Cantidad mínima de tokens de salida esperada
  amountOut?: string;              // Cantidad real de tokens recibidos
  senderAddress: string;           // Dirección del remitente
  receiveAddress: string;          // Dirección donde se reciben los tokens
  transactionHash?: string;        // Hash de la transacción
  status: SwapTransactionStatus;
  error?: string;                  // Mensaje de error si hubo uno
  metadata?: Record<string, any>;  // Metadatos adicionales (slippage, etc.)
  createdAt: Date;
  updatedAt: Date;
}

// Estados posibles para una transacción de swap
export enum SwapTransactionStatus {
  PENDING = 'PENDING',             // Esperando ejecución
  SENT = 'SENT',                   // Transacción enviada
  CONFIRMED = 'CONFIRMED',         // Swap confirmado
  FAILED = 'FAILED'                // Swap fallido
}

// Interfaz para creación (algunos campos opcionales al crear)
export interface SwapTransactionCreationAttributes extends Optional<SwapTransactionAttributes, 
  'id' | 'amountOut' | 'transactionHash' | 'status' | 'error' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// Definir clase del modelo
class SwapTransaction extends Model<SwapTransactionAttributes, SwapTransactionCreationAttributes> 
  implements SwapTransactionAttributes {
  
  public id!: string;
  public paymentId!: string;
  public tokenInAddress!: string;
  public tokenOutAddress!: string;
  public amountIn!: string;
  public amountOutMin!: string;
  public amountOut?: string;
  public senderAddress!: string;
  public receiveAddress!: string;
  public transactionHash?: string;
  public status!: SwapTransactionStatus;
  public error?: string;
  public metadata?: Record<string, any>;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Métodos adicionales
  public markAsSent(transactionHash: string): void {
    this.transactionHash = transactionHash;
    this.status = SwapTransactionStatus.SENT;
  }
  
  public markAsConfirmed(amountOut: string): void {
    this.amountOut = amountOut;
    this.status = SwapTransactionStatus.CONFIRMED;
  }
  
  public markAsFailed(error: string): void {
    this.error = error;
    this.status = SwapTransactionStatus.FAILED;
  }
  
  // Calcula slippage en porcentaje si tenemos amountOut
  public getSlippage(): number | null {
    if (!this.amountOut) return null;
    
    const amountOutMin = BigInt(this.amountOutMin);
    const amountOut = BigInt(this.amountOut);
    
    if (amountOut >= amountOutMin) {
      // No slippage negativo
      return 0;
    }
    
    // Calcular slippage como porcentaje: (amountOutMin - amountOut) / amountOutMin * 100
    const slippage = (amountOutMin - amountOut) * BigInt(10000) / amountOutMin;
    return Number(slippage) / 100; // Convertir a porcentaje con 2 decimales
  }
}

// Inicializar modelo
SwapTransaction.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tokenInAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tokenOutAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amountIn: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amountOutMin: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amountOut: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  senderAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  receiveAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  transactionHash: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM(...Object.values(SwapTransactionStatus)),
    allowNull: false,
    defaultValue: SwapTransactionStatus.PENDING,
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
  modelName: 'SwapTransaction',
  tableName: 'swap_transactions',
  timestamps: true,
});

export default SwapTransaction; 