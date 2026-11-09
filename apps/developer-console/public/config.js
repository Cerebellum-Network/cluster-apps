// Placeholder. In a deployment the Helm chart (cef-billing-console) mounts a
// populated config.js over this file; locally, src/config.ts falls back to
// VITE_* env vars. Keys: reconUrl, paymentUrl, orchestratorUrl, walletOrigin,
// network, features { chainDeposit, chainStatus, declinedBanner }.
window.__RUNTIME_CONFIG__ = window.__RUNTIME_CONFIG__ || {};
