// Placeholder. In a deployment the Helm chart (cef-developer-console) mounts a
// populated config.js over this file; locally, src/config.ts + the storage slice
// (src/storage/storageConfig.ts) fall back to VITE_* env vars. Keys:
//   walletOrigin, network, walletTransport,
//   storage { blockchainIndexUrl, ddcS3GatewayUrl, ddcCdnUrl, clusterId, statsEndpoint }.
window.__RUNTIME_CONFIG__ = window.__RUNTIME_CONFIG__ || {};
