// Contract addresses
export const CONTRACT_HYPERBRIDGE_ADDRESS = process.env.CONTRACT_HYPERBRIDGE_ADDRESS || '';
export const CONTRACT_TOKEN_SWAPPER_ADDRESS = process.env.CONTRACT_TOKEN_SWAPPER_ADDRESS || '';
export const CERE_TOKEN_ADDRESS = process.env.CERE_TOKEN_ADDRESS || '';

// Network configuration
export const CONTRACT_NETWORK_RPC_URL = process.env.CONTRACT_NETWORK_RPC_URL || 'http://localhost:8545';

// Supported stablecoins
export const SUPPORTED_STABLECOINS = {
  USDC: process.env.USDC_ADDRESS || '',
  USDT: process.env.USDT_ADDRESS || ''
};

// Monitoring settings
export const MONITORING_INTERVAL_MS = 30000; // Check every 30 seconds
export const MAX_MONITORING_RETRIES = 20; // Retry up to 20 times (10 minutes total)

// Retry settings
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 5000; // Initial delay of 5 seconds
export const RETRY_BACKOFF_FACTOR = 2; // Double the delay after each attempt 

// Gas optimization settings
export const GAS_PRICE_MULTIPLIER = 120n; // 120% of base fee
export const MAX_GAS_PRICE = 500000000000n; // 500 gwei
export const MIN_CONFIRMATIONS = 3;
export const GAS_ESTIMATION_BUFFER = 120n; // 120% of estimated gas 