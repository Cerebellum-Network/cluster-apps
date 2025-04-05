/**
 * Middleware para verificación de roles de usuario
 * Parte de la subtarea #4.2 - Implement Secure Credential Management for Stripe
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger';

/**
 * Middleware para verificar si el usuario tiene rol de administrador
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }
    
    // Verificar si el usuario tiene el rol de administrador
    const userRole = req.user.role;
    
    if (userRole !== 'admin') {
      logger.warn(`Unauthorized access attempt to admin route by user ${req.user.id}`);
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }
    
    // Si el usuario es administrador, permitir el acceso
    next();
  } catch (error) {
    logger.error('Error in isAdmin middleware', error);
    res.status(500).json({
      success: false,
      message: 'Server error while validating permissions'
    });
  }
};

/**
 * Middleware para verificar si el usuario tiene un rol específico
 * @param role Rol requerido
 */
export const hasRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Verificar que el usuario esté autenticado
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      // Verificar si el usuario tiene el rol requerido
      const userRole = req.user.role;
      
      if (userRole !== role) {
        logger.warn(`Unauthorized access attempt to route requiring '${role}' role by user ${req.user.id}`);
        res.status(403).json({
          success: false,
          message: `Access denied. '${role}' role required`
        });
        return;
      }
      
      // Si el usuario tiene el rol requerido, permitir el acceso
      next();
    } catch (error) {
      logger.error(`Error in hasRole('${role}') middleware`, error);
      res.status(500).json({
        success: false,
        message: 'Server error while validating permissions'
      });
    }
  };
};

/**
 * Middleware para verificar si el usuario tiene al menos uno de los roles especificados
 * @param roles Lista de roles permitidos
 */
export const hasAnyRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Verificar que el usuario esté autenticado
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      // Verificar si el usuario tiene alguno de los roles requeridos
      const userRole = req.user.role;
      
      if (!roles.includes(userRole)) {
        logger.warn(`Unauthorized access attempt to route requiring one of [${roles.join(', ')}] roles by user ${req.user.id}`);
        res.status(403).json({
          success: false,
          message: `Access denied. One of [${roles.join(', ')}] roles required`
        });
        return;
      }
      
      // Si el usuario tiene alguno de los roles requeridos, permitir el acceso
      next();
    } catch (error) {
      logger.error(`Error in hasAnyRole([${roles.join(', ')}]) middleware`, error);
      res.status(500).json({
        success: false,
        message: 'Server error while validating permissions'
      });
    }
  };
}; 