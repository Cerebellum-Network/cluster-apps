import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services';
import logger, { logError } from '../utils/logger';
import { UserRole } from '../models/User';

// Extender la interfaz Request para incluir el usuario
declare global {
  namespace Express {
    interface Request {
      user?: any;
      token?: string;
    }
  }
}

/**
 * Middleware para autenticar mediante JWT en el header Authorization
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Extraer el token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
      return;
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verificar el token
    const decoded = AuthService.verifyToken(token);
    
    if (!decoded) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid or expired token'
      });
      return;
    }
    
    // Almacenar información del usuario en el objeto request
    req.user = decoded;
    req.token = token;
    
    next();
  } catch (error) {
    logError('Authentication error', error);
    res.status(500).json({
      status: 'error',
      message: 'Authentication failed'
    });
  }
};

/**
 * Middleware para autenticar mediante API key en el header X-API-Key
 */
export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Extraer API key del header
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      res.status(401).json({
        status: 'error',
        message: 'API key required'
      });
      return;
    }
    
    // Autenticar con API key
    const user = await AuthService.loginWithApiKey(apiKey);
    
    if (!user) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid API key'
      });
      return;
    }
    
    // Almacenar información del usuario en el objeto request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    logError('API key authentication error', error);
    res.status(500).json({
      status: 'error',
      message: 'API authentication failed'
    });
  }
};

/**
 * Middleware para verificar permisos de administrador
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user && req.user.role === UserRole.ADMIN) {
    next();
  } else {
    logger.warn(`Access denied: User ${req.user?.username || 'unknown'} attempted to access admin-only resource`);
    res.status(403).json({
      status: 'error',
      message: 'Access denied: Admin privileges required'
    });
  }
};

/**
 * Middleware para verificar permisos de API
 */
export const requireApiRole = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user && (req.user.role === UserRole.API || req.user.role === UserRole.ADMIN)) {
    next();
  } else {
    logger.warn(`API access denied: User ${req.user?.username || 'unknown'} attempted to access API-only resource`);
    res.status(403).json({
      status: 'error',
      message: 'Access denied: API privileges required'
    });
  }
};

/**
 * Middleware flexible para verificar varios roles
 * @param roles Lista de roles permitidos
 */
export const requireRoles = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user && roles.includes(req.user.role)) {
      next();
    } else {
      logger.warn(`Role-based access denied: User ${req.user?.username || 'unknown'} (role: ${req.user?.role || 'none'}) attempted to access resource requiring ${roles.join(', ')}`);
      res.status(403).json({
        status: 'error',
        message: `Access denied: Required roles: ${roles.join(', ')}`
      });
    }
  };
}; 