/**
 * Compatibility shim.
 *
 * These two symbols are imported by SIBLING workspaces that referenced the
 * previous developer-console source:
 *   - `DDC_CLUSTER_ID` — node-provider (DdcBlockchainStore, NetworkTopology)
 *   - `DISCORD_LINK`   — packages/ui (MobileOverlay)
 *
 * The console's own code does not use this file (it reads config from
 * config.ts / storage/storageConfig.ts). It is kept only so the rebuild does not
 * break those siblings. TODO: move these to a shared package and drop this shim
 * (decouple node-provider and packages/ui from developer-console internals).
 */
import type { ClusterId } from '@cere-ddc-sdk/blockchain';

export const DDC_CLUSTER_ID = (import.meta.env.VITE_DDC_CLUSTER_ID || '0x0') as ClusterId;

export const DISCORD_LINK = 'https://discord.gg/HtkRSgUCMB';
