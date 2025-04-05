import ContractService from './ContractService';
import AuthService from './AuthService';

// Exportar servicios
export { default as AuthService } from './AuthService';
export { default as PaymentService } from './PaymentService';
export { default as ContractService } from './ContractService';
export { default as StripeService } from './StripeService';

// Inicializar todos los servicios
export const initServices = async (): Promise<void> => {
  // Por ahora solo tenemos servicios que se inicializan al importarlos
  
  // A medida que agreguemos más servicios que requieran inicialización
  // explícita, podemos hacerlo aquí
}; 