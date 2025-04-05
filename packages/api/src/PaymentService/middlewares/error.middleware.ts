import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'express-validator';
import logger, { logError } from '../utils/logger';

// Tipos de errores personalizados para la aplicación
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Indica que es un error conocido y controlado

    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso no encontrado') {
    super(message, 404);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Petición inválida') {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'No autorizado') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Acceso prohibido') {
    super(message, 403);
  }
}

export class ValidationRequestError extends AppError {
  errors: ValidationError[];
  
  constructor(errors: ValidationError[], message: string = 'Error de validación') {
    super(message, 400);
    this.errors = errors;
  }
}

export class PaymentProcessingError extends AppError {
  step: string;
  
  constructor(step: string, message: string = 'Error procesando el pago') {
    super(message, 500);
    this.step = step;
  }
}

export class ContractInteractionError extends AppError {
  contractAddress: string;
  operation: string;
  
  constructor(contractAddress: string, operation: string, message: string = 'Error interactuando con contrato') {
    super(message, 500);
    this.contractAddress = contractAddress;
    this.operation = operation;
  }
}

// Middleware para manejar errores 404 (rutas no encontradas)
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Ruta no encontrada: ${req.originalUrl}`));
};

// Middleware para manejo global de errores
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Determinar statusCode (500 por defecto para errores internos)
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;
  
  // Formatear mensaje de error
  const errorResponse = {
    success: false,
    status: statusCode,
    message: err.message || 'Error interno del servidor',
    errors: err.errors || null,
    step: err.step || null,
    isOperational
  };
  
  // Errores operacionales son esperados (ej: validación, autenticación)
  if (isOperational) {
    logger.warn(`Error operacional: ${err.message}`, {
      path: req.path,
      statusCode,
      method: req.method,
      ...(err.errors && { errors: err.errors }),
      ...(err.step && { step: err.step })
    });
  } else {
    // Errores no operacionales son bugs y deben ser investigados
    logError('Error no operacional', err, {
      path: req.path,
      method: req.method,
      body: req.body,
      headers: req.headers,
      user: req.user
    });
  }
  
  // En desarrollo, incluir el stack trace
  if (process.env.NODE_ENV === 'development') {
    errorResponse['stack'] = err.stack;
  }
  
  // Eliminar datos nulos/undefined del response
  Object.keys(errorResponse).forEach(key => {
    if (errorResponse[key] === null || errorResponse[key] === undefined) {
      delete errorResponse[key];
    }
  });
  
  res.status(statusCode).json(errorResponse);
};

// Middleware para capturar rechazos de promesas no manejados
export const asyncErrorHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}; 