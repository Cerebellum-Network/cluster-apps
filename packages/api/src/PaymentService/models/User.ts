import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcrypt';

// Definir interfaz para los atributos del usuario
export interface UserAttributes {
  id: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  apiKey?: string;
  walletAddress?: string;
  cereNetworkAddress?: string;
  active: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Enumerar los posibles roles de usuario
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  API = 'API'
}

// Interfaz para la creación (algunos campos son opcionales al crear)
export interface UserCreationAttributes extends Optional<UserAttributes, 
  'id' | 'role' | 'apiKey' | 'walletAddress' | 'cereNetworkAddress' | 'active' | 'lastLogin' | 'createdAt' | 'updatedAt'> {}

// Definir clase del modelo
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public username!: string;
  public email!: string;
  public password!: string;
  public role!: UserRole;
  public apiKey?: string;
  public walletAddress?: string;
  public cereNetworkAddress?: string;
  public active!: boolean;
  public lastLogin?: Date;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Método para comparar contraseñas
  public async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }
  
  // Método para generar API key
  public generateApiKey(): string {
    const apiKey = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15) +
                  Date.now().toString(36);
    this.apiKey = apiKey;
    return apiKey;
  }
}

// Inicializar modelo
User.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM(...Object.values(UserRole)),
    allowNull: false,
    defaultValue: UserRole.USER,
  },
  apiKey: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  walletAddress: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      is: /^0x[a-fA-F0-9]{40}$/i // Formato de dirección Ethereum
    }
  },
  cereNetworkAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  lastLogin: {
    type: DataTypes.DATE,
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
  modelName: 'User',
  tableName: 'users',
  timestamps: true,
  hooks: {
    // Hash de la contraseña antes de guardar
    beforeSave: async (user: User) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

export default User; 