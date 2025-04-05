// Este archivo exporta las principales funcionalidades del servicio de pagos

// Re-exportar configuraciones
export * from './config/env';

// Re-exportar utilidades
export { default as logger, logError } from './utils/logger';

// Exportar modelos
export * from './models';

// Exportar servicios
export * from './services';

// Exportar controladores
export * from './controllers';

// Función principal para inicializar el servicio de pagos
export const initPaymentService = async (): Promise<void> => {
  // Inicializar componentes necesarios
  try {
    // Aquí se inicializarán conexiones a servicios externos, 
    // como contratos inteligentes, proveedores de pago, etc.
    logger.info('Initializing Payment Service...');
    logger.info('✅ Payment Service initialized successfully');
  } catch (error) {
    logError('Failed to initialize Payment Service', error);
    throw error;
  }
}; 