// Exportar middlewares de autenticación
export * from './auth.middleware';

// Exportar middlewares de manejo de errores
export * from './error.middleware';

// Exportar middleware de validación
export * from './validation.middleware';

// Exportar middleware de registro de solicitudes
export * from './request-logger.middleware';

// Exportar middlewares específicos
export { default as validate } from './validation.middleware';
export { default as requestLogger } from './request-logger.middleware';

// Middleware para el manejo de errores
import { Request, Response, NextFunction } from 'express';
import { NODE_ENV } from '../config/env';
import logger from '../utils/logger';

export const errorHandler = (
  err: Error, 
  req: Request, 
  res: Response, 
  next: NextFunction
): void => {
  logger.error(`Error: ${err.message}`, { stack: err.stack });
  
  res.status(500).json({
    status: 'error',
    message: NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    stack: NODE_ENV === 'production' ? undefined : err.stack
  });
};

// Middleware para rutas no encontradas
export const notFoundHandler = (
  req: Request, 
  res: Response
): void => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}; 