import winston, { format, transports } from 'winston';
import { LOG_LEVEL, NODE_ENV } from '../config/env';

// Formato personalizado para los logs
const customFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

// Formato para logs en consola (más legible para desarrollo)
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length
      ? `\n${JSON.stringify(meta, null, 2)}`
      : '';
    return `[${timestamp}] ${level}: ${message}${metaString}`;
  })
);

// Crear logger
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: customFormat,
  defaultMeta: { service: 'payment-service' },
  transports: [
    // Escribir logs de error y advertencia a error.log
    new transports.File({ 
      filename: 'logs/error.log', 
      level: 'error'
    }),
    // Escribir logs combinados a combined.log
    new transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Logs a la consola
    new transports.Console({
      format: consoleFormat
    })
  ],
  exceptionHandlers: [
    // Capturar excepciones no manejadas
    new transports.File({ 
      filename: 'logs/exceptions.log' 
    }),
    new transports.Console({
      format: consoleFormat
    })
  ],
  rejectionHandlers: [
    // Capturar promesas rechazadas no manejadas
    new transports.File({ 
      filename: 'logs/rejections.log' 
    }),
    new transports.Console({
      format: consoleFormat
    })
  ]
});

// En desarrollo, también imprimimos en la consola con colores
if (NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

// Función para loguear errores con stack trace
export const logError = (message: string, error: any, additionalContext?: Record<string, any>): void => {
  const errorObj = {
    message,
    error: {
      name: error.name || 'Unknown Error',
      message: error.message || String(error),
      stack: error.stack || 'No stack trace available'
    },
    ...additionalContext
  };
  
  logger.error(errorObj);
};

// Función para loguear información de transacciones
export const logTransaction = (
  transactionId: string, 
  action: string, 
  status: string, 
  details: Record<string, any>
): void => {
  logger.info({
    transaction: {
      id: transactionId,
      action,
      status,
      timestamp: new Date().toISOString(),
      details
    }
  });
};

// Función para loguear acceso a la API
export const logApiAccess = (
  req: any, 
  responseTime?: number
): void => {
  logger.http({
    api: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: req.user?.id || 'anonymous',
      userAgent: req.get('user-agent'),
      responseTime: responseTime ? `${responseTime}ms` : undefined
    }
  });
};

// Exportar logger
export default logger; 