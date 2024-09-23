import npmPackage from '../package.json';

/**
 * Cere Wallet app configuration
 */
export const APP_ID = import.meta.env.VITE_GLOBAL_REGISTRY_APP_ID || 'global-registry';
export const APP_NAME = import.meta.env.VITE_GLOBAL_REGISTRY_APP_NAME || 'Global Access Registry';
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'dev';
export const APP_EMAIL = import.meta.env.VITE_APP_EMAIL || 'team@cere.network';
export const APP_VERSION = npmPackage.version;

/**
 * DDC configuration
 */
export const DDC_CLUSTER_NAME = import.meta.env.VITE_DDC_CLUSTER_NAME || 'Dragon 1';
