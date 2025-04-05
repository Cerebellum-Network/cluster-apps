import { Request, Response, NextFunction } from 'express';
import { logApiAccess } from '../utils/logger';

/**
 * Middleware para registrar las solicitudes HTTP
 * Registra información sobre cada solicitud, incluyendo:
 * - Método HTTP
 * - Ruta de la solicitud
 * - Dirección IP del cliente
 * - ID de usuario (si está autenticado)
 * - User Agent
 * - Tiempo de respuesta
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Registrar tiempo de inicio
  const startHrTime = process.hrtime();
  
  // Registrar solicitud al inicio (opcional, útil para depuración)
  // logApiAccess(req);
  
  // Una vez que se complete la respuesta
  res.on('finish', () => {
    // Calcular tiempo de respuesta
    const elapsedHrTime = process.hrtime(startHrTime);
    const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1000000;
    
    // Registrar la solicitud completada con el tiempo de respuesta
    logApiAccess(req, elapsedTimeInMs);
  });
  
  next();
};

export default requestLogger; 