import { DEVNET, MAINNET, TESTNET } from '@cere-ddc-sdk/ddc-client';

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

/**
 * DDC configuration
 */
const ddcPreset = (import.meta.env.VITE_DDC_NETWORK || 'testnet') as keyof typeof ddcPresets;
export const DDC_PRESET = ddcPresets[ddcPreset];
export const DDC_CLUSTER_ID = import.meta.env.VITE_DDC_CLUSTER_ID || '';
export const DDC_CLUSTER_NAME = import.meta.env.VITE_DDC_CLUSTER_NAME || 'Dragon 1';
export const DDC_STORAGE_NODE_URL = import.meta.env.VITE_DDC_STORAGE_NODE_URL || '';

/**
 * Cere blockchain configuration
 */
export const CERE_DECIMALS = Number(import.meta.env.VITE_CERE_DECIMALS || 10);

/**
 * Onboarding configuration
 */
export const ONBOARDIN_REWARD_AMOUNT = Number(import.meta.env.VITE_ONBOARDIN_REWARD_AMOUNT || 50);
export const ONBOARDIN_DEPOSIT_AMOUNT = Number(import.meta.env.VITE_ONBOARDIN_DEPOSIT_AMOUNT || 40);
export const ONBOARDIN_PUBLIC_BUCKET = false;
