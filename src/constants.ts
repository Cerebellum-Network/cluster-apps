import { DEVNET, MAINNET, TESTNET } from '@cere-ddc-sdk/ddc-client';

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
export const ONBOARDIN_PUBLIC_BUCKET = true;

/**
 * Project Links
 */

export const DISCORD_LINK = 'https://discord.com/invite/8RBXaQ6nT5';
export const DEVELOPER_DOCS_LINK = 'https://www.developer.cere.network/get-started';
export const TERMS_AND_CONDITIONS_LINK =
  'https://www.notion.so/cere/Terms-and-conditions-6728e7cf5ab74c0eb95e52b62e4f0b6f?pvs=4';
export const PRIVACY_POLICY = 'https://www.notion.so/cere/Privacy-policy-520cc63dbf8d4840b3cbad6eeee9c218?pvs=4';
