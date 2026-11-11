import { ClusterId } from '@cere-ddc-sdk/blockchain';

import npmPackage from '../package.json';

import { storageConfig } from './storage/storageConfig';

/**
 * App identity (analytics / wallet labelling). The wallet + network identity
 * proper lives in `src/config.ts`; these remain for the few UI call-sites that
 * still read them.
 */
export const APP_ID = import.meta.env.VITE_APP_ID || 'developer-console';
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Developer Console';
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'dev';
export const APP_EMAIL = import.meta.env.VITE_APP_EMAIL || 'team@cere.network';
export const APP_VERSION = npmPackage.version;

/**
 * DDC configuration. The cluster id + endpoints now live in
 * `src/storage/storageConfig.ts` (runtime config). The SDK v3 chain client
 * resolves the blockchain WS endpoint from `config.network`. Kept as the branded
 * `ClusterId` (`0x${string}`) that the chain calls expect -- node-provider
 * imports this symbol and feeds it to v2 `ddcStaking`/`ddcClusters` APIs, which
 * reject a plain `string`.
 */
export const DDC_CLUSTER_ID = storageConfig.clusterId as ClusterId;
export const DDC_CLUSTER_NAME = import.meta.env.VITE_DDC_CLUSTER_NAME || 'Dragon 1';

/**
 * Cere blockchain configuration
 */
export const CERE_DECIMALS = Number(import.meta.env.VITE_CERE_DECIMALS || 10);

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
