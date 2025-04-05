import { Chain, configureChains, createConfig } from 'wagmi';
import { mainnet, polygon, arbitrum, optimism, sepolia } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { infuraProvider } from 'wagmi/providers/infura';
import { alchemyProvider } from 'wagmi/providers/alchemy';

// Obtener claves de API de variables de entorno
const infuraKey = import.meta.env.VITE_INFURA_API_KEY || '';
const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY || '';

// Lista de cadenas compatibles
export const supportedChains: Chain[] = [
  mainnet,
  polygon,
  arbitrum,
  optimism,
  sepolia // Red de prueba para desarrollo
];

// Configurar los proveedores de cadena
const { chains, publicClient, webSocketPublicClient } = configureChains(
  supportedChains,
  [
    infuraProvider({ apiKey: infuraKey }),
    alchemyProvider({ apiKey: alchemyKey }),
    publicProvider(),
  ]
);

// Crear configuración de Wagmi
export const wagmiConfig = createConfig({
  autoConnect: true,
  publicClient,
  webSocketPublicClient,
});

// Exportar cadenas para usar en otros componentes
export { chains };

// Mapa para los iconos de wallet (URLs de ejemplo)
export const walletIcons = {
  metamask: '/wallet-icons/metamask.svg',
  walletconnect: '/wallet-icons/walletconnect.svg',
  coinbase: '/wallet-icons/coinbase.svg',
  cere: '/wallet-icons/cere.svg',
};

// Stablecoins soportadas y sus direcciones por cadena
export const SUPPORTED_STABLECOINS: Record<string, Record<number, string>> = {
  USDC: {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Mainnet
    137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Polygon
    42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum
    10: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // Optimism
    11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
  },
  USDT: {
    1: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Mainnet
    137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // Polygon
    42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // Arbitrum
    10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // Optimism
    11155111: '0x4CfE225cE54c6609a525768065A3AF27a1c4E12E', // Sepolia
  }
};

// Dirección del contrato de pago (StablecoinPaymentHandler) por cadena
export const PAYMENT_CONTRACT_ADDRESS: Record<number, string> = {
  1: '0x1234567890123456789012345678901234567890', // Placeholder para Mainnet
  137: '0x2234567890123456789012345678901234567890', // Placeholder para Polygon
  42161: '0x3234567890123456789012345678901234567890', // Placeholder para Arbitrum
  10: '0x4234567890123456789012345678901234567890', // Placeholder para Optimism
  11155111: '0x5234567890123456789012345678901234567890', // Placeholder para Sepolia
}; 