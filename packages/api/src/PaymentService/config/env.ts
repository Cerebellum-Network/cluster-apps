import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno según el ambiente
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Configuración del servidor
export const SERVER_PORT = process.env.SERVER_PORT || '3100';
export const NODE_ENV = process.env.NODE_ENV || 'development';

// Configuración de la base de datos
export const DB_HOST = process.env.DB_HOST || 'localhost';
export const DB_PORT = process.env.DB_PORT || '5432';
export const DB_NAME = process.env.DB_NAME || 'payment_service';
export const DB_USER = process.env.DB_USER || 'postgres';
export const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

// Configuración JWT
export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

// Configuración de contratos
export const CONTRACT_PAYMENT_HANDLER_ADDRESS = process.env.CONTRACT_PAYMENT_HANDLER_ADDRESS || '';
export const CONTRACT_TOKEN_SWAPPER_ADDRESS = process.env.CONTRACT_TOKEN_SWAPPER_ADDRESS || '';
export const CONTRACT_HYPERBRIDGE_ADDRESS = process.env.CONTRACT_HYPERBRIDGE_ADDRESS || '';
export const CONTRACT_NETWORK_RPC_URL = process.env.CONTRACT_NETWORK_RPC_URL || 'https://sepolia.infura.io/v3/your-infura-key';
export const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || '';
export const CERE_TOKEN_ADDRESS = process.env.CERE_TOKEN_ADDRESS || '0xCereTokenAddress';

// Configuración de proveedores de pago
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'your-stripe-key';
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'your-stripe-webhook-secret';

// Configuración API Cere DDC
export const CERE_API_URL = process.env.CERE_API_URL || 'https://api.cere.network';
export const CERE_API_KEY = process.env.CERE_API_KEY || 'your-cere-api-key';

// Configuración de verificación de balance
export const BALANCE_VERIFICATION_DELAY_MS = Number(process.env.BALANCE_VERIFICATION_DELAY_MS || '15000'); // 15 segundos
export const BALANCE_VERIFICATION_MAX_RETRIES = Number(process.env.BALANCE_VERIFICATION_MAX_RETRIES || '10');
export const BALANCE_VERIFICATION_TIMEOUT_MS = Number(process.env.BALANCE_VERIFICATION_TIMEOUT_MS || '600000'); // 10 minutos
export const BALANCE_EXPECTED_INCREASE_MARGIN = Number(process.env.BALANCE_EXPECTED_INCREASE_MARGIN || '5'); // 5% de margen de error

// Logs
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Lista de stablecoins soportadas con sus direcciones de contrato
export const SUPPORTED_STABLECOINS = {
  USDC: process.env.USDC_CONTRACT_ADDRESS || '',
  USDT: process.env.USDT_CONTRACT_ADDRESS || '',
}; 