import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/env';
import User, { UserRole } from '../models/User';
import logger, { logError } from '../utils/logger';

// Interfaz para el payload del token JWT
interface TokenPayload {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

// Interfaz para payload con cualquier dato adicional
interface DecodedToken extends TokenPayload {
  iat?: number;  // Issued at time
  exp?: number;  // Expiration time
  [key: string]: any; // Permitir otros campos
}

class AuthService {
  /**
   * Genera un token JWT para un usuario
   * @param user Usuario para el que se genera el token
   * @returns Token JWT generado
   */
  generateToken(user: User): string {
    try {
      const payload: TokenPayload = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };
      
      return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
      });
    } catch (error) {
      logError('Error generating JWT token', error);
      throw new Error('Failed to generate authentication token');
    }
  }
  
  /**
   * Verifica y decodifica un token JWT
   * @param token Token JWT a verificar
   * @returns Payload decodificado o null si es inválido
   */
  verifyToken(token: string): DecodedToken | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
      return decoded;
    } catch (error) {
      logError('Error verifying JWT token', error);
      return null;
    }
  }
  
  /**
   * Autenticar un usuario mediante usuario y contraseña
   * @param username Nombre de usuario o email
   * @param password Contraseña
   * @returns Usuario y token JWT o null si la autenticación falla
   */
  async loginWithCredentials(username: string, password: string): Promise<{ user: User; token: string } | null> {
    try {
      // Buscar usuario por nombre de usuario o email
      const user = await User.findOne({
        where: {
          [username.includes('@') ? 'email' : 'username']: username,
          active: true
        }
      });
      
      if (!user) {
        logger.warn(`Login attempt failed: User "${username}" not found or inactive`);
        return null;
      }
      
      // Verificar contraseña
      const passwordMatch = await user.comparePassword(password);
      if (!passwordMatch) {
        logger.warn(`Login attempt failed: Invalid password for user "${username}"`);
        return null;
      }
      
      // Actualizar último login
      user.lastLogin = new Date();
      await user.save();
      
      // Generar token
      const token = this.generateToken(user);
      
      logger.info(`User "${username}" authenticated successfully`);
      return { user, token };
    } catch (error) {
      logError(`Login attempt failed for user "${username}"`, error);
      return null;
    }
  }
  
  /**
   * Autenticar un usuario mediante API key
   * @param apiKey API key para la autenticación
   * @returns Usuario autenticado o null si la autenticación falla
   */
  async loginWithApiKey(apiKey: string): Promise<User | null> {
    try {
      // Buscar usuario por API key
      const user = await User.findOne({
        where: {
          apiKey,
          active: true,
          role: UserRole.API // Solo los usuarios API pueden usar API key
        }
      });
      
      if (!user) {
        logger.warn(`API login attempt failed: Invalid API key "${apiKey.substring(0, 8)}..."`);
        return null;
      }
      
      // Actualizar último login
      user.lastLogin = new Date();
      await user.save();
      
      logger.info(`API User "${user.username}" authenticated successfully via API key`);
      return user;
    } catch (error) {
      logError(`API login attempt failed with key "${apiKey.substring(0, 8)}..."`, error);
      return null;
    }
  }
  
  /**
   * Registrar un nuevo usuario
   * @param userData Datos del usuario a registrar
   * @returns Usuario creado y token JWT o null si el registro falla
   */
  async registerUser(userData: {
    username: string;
    email: string;
    password: string;
    role?: UserRole;
    walletAddress?: string;
    cereNetworkAddress?: string;
  }): Promise<{ user: User; token: string } | null> {
    try {
      // Verificar si ya existe un usuario con el mismo nombre o email
      const existingUser = await User.findOne({
        where: {
          [userData.username ? 'username' : 'email']: userData.username || userData.email
        }
      });
      
      if (existingUser) {
        logger.warn(`Registration failed: Username or email already exists`);
        return null;
      }
      
      // Crear nuevo usuario
      const user = await User.create({
        ...userData,
        role: userData.role || UserRole.USER, // Por defecto, rol USER
        active: true
      });
      
      // Generar token
      const token = this.generateToken(user);
      
      logger.info(`User "${userData.username}" registered successfully`);
      return { user, token };
    } catch (error) {
      logError(`Registration failed for user "${userData.username}"`, error);
      return null;
    }
  }
}

// Exportar una instancia única del servicio (singleton)
export default new AuthService(); 