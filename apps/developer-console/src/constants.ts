import { DEVNET, MAINNET, TESTNET } from '@cere-ddc-sdk/ddc-client';
import { ClusterId } from '@cere-ddc-sdk/blockchain';

import npmPackage from '../package.json';

const ddcPresets = {
  testnet: TESTNET,
  devnet: DEVNET,
  mainnet: MAINNET,
};

/**
 * Cere Wallet app configuration
 */
export const APP_ID = import.meta.env.VITE_APP_ID || 'developer-console';
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Developer Console';
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'dev';
export const APP_EMAIL = import.meta.env.VITE_APP_EMAIL || 'team@cere.network';
export const APP_VERSION = npmPackage.version;

/**
 * DDC configuration
 */
const ddcPreset = (import.meta.env.VITE_DDC_NETWORK || 'testnet') as keyof typeof ddcPresets;
export const DDC_PRESET = ddcPresets[ddcPreset];
export const DDC_CLUSTER_ID = (import.meta.env.VITE_DDC_CLUSTER_ID || '0x0') as ClusterId;
export const DDC_CLUSTER_NAME = import.meta.env.VITE_DDC_CLUSTER_NAME || 'Dragon 1';
export const DDC_STORAGE_NODE_URL = import.meta.env.VITE_DDC_STORAGE_NODE_URL || '';
export const DDC_SDK_LOG_LEVEL = import.meta.env.VITE_DDC_SDK_LOG_LEVEL || 'info';

/**
 * DDC Blockchain Retry Configuration
 */
export const DDC_BLOCKCHAIN_MAX_RETRIES = parseInt(import.meta.env.VITE_DDC_BLOCKCHAIN_MAX_RETRIES || '5');
export const DDC_BLOCKCHAIN_RETRY_DELAY = parseInt(import.meta.env.VITE_DDC_BLOCKCHAIN_RETRY_DELAY || '2000');

/**
 * Cere blockchain configuration
 */
export const CERE_DECIMALS = Number(import.meta.env.VITE_CERE_DECIMALS || 10);

/**
 * Onboarding configuration
 */
export const ONBOARDIN_REWARD_AMOUNT = Number(import.meta.env.VITE_ONBOARDIN_REWARD_AMOUNT || 50);
export const ONBOARDIN_DEPOSIT_AMOUNT = Number(import.meta.env.VITE_ONBOARDIN_DEPOSIT_AMOUNT || 40);
export const ONBOARDIN_PUBLIC_BUCKET = true;

/**
 * Project Links
 */

export const DISCORD_LINK = 'https://discord.gg/HtkRSgUCMB';
export const DEVELOPER_DOCS_LINK = 'https://www.developer.cere.network/get-started';
export const TERMS_AND_CONDITIONS_LINK =
  'https://www.notion.so/cere/Terms-and-conditions-6728e7cf5ab74c0eb95e52b62e4f0b6f?pvs=4';
export const PRIVACY_POLICY = 'https://www.notion.so/cere/Privacy-policy-520cc63dbf8d4840b3cbad6eeee9c218?pvs=4';

/**
 * Additional constants
 */
export const EMPTY_FILE_NAME = '.ddc-empty';
export const DEFAULT_FOLDER_NAME = 'default';

/**
 * Compute Tiers Configuration
 */
export interface ComputeTier {
  id: string;
  name: string;
  cpu: number;
  ram: number; // in GB
  gpuCredits: number;
  description: string;
  price?: string;
}

export const COMPUTE_TIERS: ComputeTier[] = [
  {
    id: 'basic',
    name: 'Basic',
    cpu: parseFloat(import.meta.env.VITE_COMPUTE_BASIC_CPU || '0.5'),
    ram: parseFloat(import.meta.env.VITE_COMPUTE_BASIC_RAM || '0.5'),
    gpuCredits: parseInt(import.meta.env.VITE_COMPUTE_BASIC_GPU_CREDITS || '100'),
    description: 'Perfect for small projects and testing',
    price: import.meta.env.VITE_COMPUTE_BASIC_PRICE || 'Free',
  },
  {
    id: 'advanced',
    name: 'Advanced',
    cpu: parseFloat(import.meta.env.VITE_COMPUTE_ADVANCED_CPU || '2'),
    ram: parseFloat(import.meta.env.VITE_COMPUTE_ADVANCED_RAM || '4'),
    gpuCredits: parseInt(import.meta.env.VITE_COMPUTE_ADVANCED_GPU_CREDITS || '1000'),
    description: 'Ideal for production applications',
    price: import.meta.env.VITE_COMPUTE_ADVANCED_PRICE || 'Premium',
  },
  {
    id: 'pro',
    name: 'Pro',
    cpu: parseFloat(import.meta.env.VITE_COMPUTE_PRO_CPU || '8'),
    ram: parseFloat(import.meta.env.VITE_COMPUTE_PRO_RAM || '16'),
    gpuCredits: parseInt(import.meta.env.VITE_COMPUTE_PRO_GPU_CREDITS || '10000'),
    description: 'Enterprise-grade compute power',
    price: import.meta.env.VITE_COMPUTE_PRO_PRICE || 'Enterprise',
  },
];

/**
 * Admin Configuration
 */
export const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').filter(Boolean);

/**
 * Feature flags
 */
export const FEATURE_USER_ONBOARDING = import.meta.env.VITE_FEATURE_USER_ONBOARDING !== 'false';
