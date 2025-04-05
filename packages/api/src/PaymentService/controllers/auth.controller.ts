import { Request, Response } from 'express';
import { AuthService } from '../services';
import { UserRole } from '../models/User';
import { logError } from '../utils/logger';

/**
 * Controlador para las rutas de autenticación
 */
export default {
  /**
   * Login de usuario con credenciales
   * @route POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;
      
      // Validar datos de entrada
      if (!username || !password) {
        res.status(400).json({
          status: 'error',
          message: 'Username and password are required'
        });
        return;
      }
      
      // Autenticar usuario
      const result = await AuthService.loginWithCredentials(username, password);
      
      if (!result) {
        res.status(401).json({
          status: 'error',
          message: 'Invalid credentials'
        });
        return;
      }
      
      // Devolver token y datos de usuario (excepto la contraseña)
      const { user, token } = result;
      const { password: _, ...userWithoutPassword } = user.toJSON();
      
      res.status(200).json({
        status: 'success',
        data: {
          user: userWithoutPassword,
          token
        }
      });
    } catch (error) {
      logError('Login controller error', error);
      res.status(500).json({
        status: 'error',
        message: 'Authentication failed'
      });
    }
  },
  
  /**
   * Registro de nuevo usuario
   * @route POST /api/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, email, password, walletAddress, cereNetworkAddress } = req.body;
      
      // Validar datos de entrada
      if (!username || !email || !password) {
        res.status(400).json({
          status: 'error',
          message: 'Username, email and password are required'
        });
        return;
      }
      
      // Registrar usuario
      const result = await AuthService.registerUser({
        username,
        email,
        password,
        walletAddress,
        cereNetworkAddress,
        role: UserRole.USER // Por defecto, registramos como usuario normal
      });
      
      if (!result) {
        res.status(400).json({
          status: 'error',
          message: 'Registration failed. Username or email already exists.'
        });
        return;
      }
      
      // Devolver token y datos de usuario (excepto la contraseña)
      const { user, token } = result;
      const { password: _, ...userWithoutPassword } = user.toJSON();
      
      res.status(201).json({
        status: 'success',
        data: {
          user: userWithoutPassword,
          token
        }
      });
    } catch (error) {
      logError('Register controller error', error);
      res.status(500).json({
        status: 'error',
        message: 'Registration failed'
      });
    }
  },
  
  /**
   * Obtener información del usuario actual
   * @route GET /api/auth/me
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          status: 'error',
          message: 'Not authenticated'
        });
        return;
      }
      
      res.status(200).json({
        status: 'success',
        data: {
          user: req.user
        }
      });
    } catch (error) {
      logError('GetProfile controller error', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve user profile'
      });
    }
  }
}; 