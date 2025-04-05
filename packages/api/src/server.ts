import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { SERVER_PORT, NODE_ENV } from './PaymentService/config/env';
import { testDatabaseConnection } from './PaymentService/config/database';
import logger from './PaymentService/utils/logger';
import { syncModels } from './PaymentService/models';
import { errorHandler, notFoundHandler, requestLogger } from './PaymentService/middlewares';
import path from 'path';
import fs from 'fs';

// Importar rutas
import apiRoutes from './PaymentService/routes';

// Crear aplicación Express
const app: Express = express();

// Directorio de logs (asegurarse de que existe)
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Morgan para logging básico de HTTP (solo en desarrollo)
if (NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Middleware personalizado de logging
app.use(requestLogger);

// Rutas de la API
app.use('/api', apiRoutes);

// Ruta de estado de salud
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'UP', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// Middleware para rutas no encontradas
app.use(notFoundHandler);

// Middleware para manejo de errores
app.use(errorHandler);

// Iniciar servidor
const startServer = async () => {
  try {
    // Comprobar conexión a la base de datos
    await testDatabaseConnection();
    
    // Sincronizar modelos (en desarrollo, podemos forzar la recreación de tablas)
    await syncModels(NODE_ENV === 'development');
    
    // Iniciar servidor
    const port = parseInt(SERVER_PORT, 10);
    app.listen(port, () => {
      logger.info(`✅ Server running on port ${port} in ${NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server', { error });
    process.exit(1);
  }
};

// Manejar señales para apagar correctamente el servidor
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing server');
  process.exit(0);
});

// Capturar rechazos de promesas no manejados
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Capturar excepciones no manejadas
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
  
  // En producción, es mejor reiniciar el proceso después de un error no manejado
  if (NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Iniciar servidor
startServer(); 