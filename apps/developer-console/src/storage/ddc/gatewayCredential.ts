/**
 * Mint a DDC S3 Gateway credential for the connected wallet.
 *
 * Ported from ROC (accountStore.createBucketStorageCredentialRegistration +
 * createGatewayDelegationToken). The flow:
 *   1. Read the gateway's public key (`GET /auth/info`).
 *   2. Mint a wallet-wide, full-access DDC `AuthToken` whose subject is the
 *      gateway (so the gateway may act for the wallet), signed by the wallet.
 *   3. Sign the registration body ('data' intent -> bare 64-byte signature, hex,
 *      no 0x, which the gateway's X-Signature verifier expects).
 *   4. `POST /auth/credentials` -> short-lived S3 access key / secret.
 *
 * NOT runtime-verified yet (needs the live gateway on an https origin the wallet
 * allows -- see STORAGE-SLICE.md).
 */
import { encodeAddress } from '@cere-ddc-sdk/blockchain';
import type { CefSigner } from '@cef-ai/wallet';
import { bytesToHex, hexToBytes, hexWithPrefix } from './hex';
import { buildRegistrationBody, type GatewayClient, type GatewayCredentials } from './gatewayClient';
import { createDdcSigner } from './signer';

const CREDENTIAL_LABEL = 'developer-console';

/** localStorage key holding this browser's stable device id. */
const DEVICE_ID_KEY = 'dc:deviceId';

/**
 * A stable per-device id so credential registration is idempotent per device:
 * the gateway returns this device's existing credential instead of minting a new
 * row on every reload. Persisted in localStorage; regenerated only if cleared.
 * Private-mode / blocked storage falls back to a fresh ephemeral id (still valid,
 * just not deduplicated across reloads).
 */
export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * TTL of the proxy-backed S3 credential. There is no 24h delegation token to
 * bound it any more — the gateway mints DDC tokens off the wallet's on-chain proxy
 * grant — so this is just the cadence at which the S3 credential is silently
 * re-minted (a 'data' signature, no wallet popup; `bucketStorage` refreshes near
 * expiry). 30 days.
 */
const CREDENTIAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * SDK 3.x decodes an AuthToken subject as SS58 only; the gateway advertises its
 * key as hex, so convert. A value that is already an address passes through.
 * (Ported from ROC's accountPubKeyToSs58.)
 */
export function gatewayPubKeyToSs58(pubKeyOrAddress: string): string {
  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(pubKeyOrAddress)) return pubKeyOrAddress;
  const hex = pubKeyOrAddress.startsWith('0x') ? pubKeyOrAddress : `0x${pubKeyOrAddress}`;
  return encodeAddress(hexToBytes(hex));
}

export async function registerGatewayCredential(
  getSigner: () => CefSigner,
  gateway: GatewayClient,
): Promise<GatewayCredentials> {
  // `.describing(...)` labels what the signature authorizes. The 'data' signing
  // intent used below does not raise the wallet's consent screen (only 'extrinsic'
  // does -- see cefDdcSigner), so this is for self-documentation; it is not a popup.
  const signer = createDdcSigner(getSigner).describing('Authorize a DDC storage gateway credential');

  // Proxy-backed registration: the wallet has added the gateway as its on-chain
  // proxy (addProxy, done in AccountStore.authorizeGateway before the first
  // bucket), so the gateway mints DDC tokens off that grant — no client-minted
  // 24h delegation token. We register with an EMPTY delegation_token and a
  // credential TTL; the storage node authorizes the gateway's prev-less token via
  // the owner's honored proxy delegates. The S3 credential is re-minted silently
  // (a 'data' signature, no popup) before it lapses, with no new on-chain grant.
  const deviceId = getOrCreateDeviceId();
  const expiresInSeconds = Math.floor(CREDENTIAL_TTL_MS / 1000);
  // device_id (idempotent per device) and expires_in_seconds must be inside the
  // SIGNED body, so signer and sender both build it through buildRegistrationBody.
  const body = buildRegistrationBody('', CREDENTIAL_LABEL, deviceId, expiresInSeconds);
  const signature = bytesToHex(await signer.sign(new TextEncoder().encode(body), 'data'));

  return gateway.registerCredentials({
    publicKey: hexWithPrefix(signer.publicKey),
    signature,
    signatureType: signer.type,
    delegationToken: '',
    label: CREDENTIAL_LABEL,
    deviceId,
    expiresInSeconds,
  });
}

/**
 * Whether the gateway is registered as this wallet's on-chain proxy. Signed GET
 * /auth/status over an EMPTY body ('data' intent: a plain message signature, no
 * consent screen) -- the gateway verifies the signature over the raw (empty) body.
 * Reads `gateway_proxy_registered`, so a returning device can skip a needless
 * add_proxy prompt.
 */
export async function fetchGatewayProxyRegistered(
  getSigner: () => CefSigner,
  gateway: GatewayClient,
): Promise<boolean> {
  const signer = createDdcSigner(getSigner);
  const signature = bytesToHex(await signer.sign(new Uint8Array(0), 'data'));
  return gateway.getAuthStatus({
    publicKey: hexWithPrefix(signer.publicKey),
    signature,
    signatureType: signer.type,
  });
}

/**
 * Revoke a specific gateway credential (DELETE /auth/credentials), so it stops
 * working at once rather than lapsing in up to 24h. Signed by the wallet ('data'
 * intent: a plain message signature, no consent screen); the signature covers the
 * exact `{"access_key_id":...}` body bytes, which the gateway binds to the wallet.
 */
export async function revokeGatewayCredential(
  getSigner: () => CefSigner,
  gateway: GatewayClient,
  accessKeyId: string,
): Promise<void> {
  const signer = createDdcSigner(getSigner);
  const body = JSON.stringify({ access_key_id: accessKeyId });
  const signature = bytesToHex(await signer.sign(new TextEncoder().encode(body), 'data'));
  await gateway.deleteCredentials({
    publicKey: hexWithPrefix(signer.publicKey),
    signature,
    signatureType: signer.type,
    body,
  });
}
