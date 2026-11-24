// Placeholder. In a deployment the Helm chart (cef-cluster-console) mounts a
// populated config.js over this file; locally src/config.ts falls back to
// VITE_* env vars, then to the Dragon 1 devnet defaults. Keys:
//   consoleBackendUrl, walletOrigin, walletTransport, network.
window.__RUNTIME_CONFIG__ = window.__RUNTIME_CONFIG__ || {};
