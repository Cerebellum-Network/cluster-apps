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
import { AuthToken } from '@cere-ddc-sdk/ddc';
import { encodeAddress } from '@cere-ddc-sdk/blockchain';
import type { CefSigner } from '@cef-ai/wallet';
import { bytesToHex, hexToBytes, hexWithPrefix } from './hex';
import { buildRegistrationBody, type GatewayClient, type GatewayCredentials } from './gatewayClient';
import { createDdcSigner } from './signer';

const CREDENTIAL_LABEL = 'developer-console';

/**
 * Lifetime of the wallet-wide gateway delegation token. The SDK default is 30
 * days (`AUTH_TOKEN_EXPIRATION_TIME`); a full-access, delegable token that lives
 * that long is a broad bearer credential, so bound it to 24h (#185 review). The
 * token is re-minted transparently on next use once it lapses; `bucketStorage`
 * refreshes the S3 credential near expiry. Per-bucket scoping is not available —
 * the gateway credential is wallet-wide — so a short lifetime is the mitigation.
 */
const DELEGATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

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
  // `.describing(...)` labels what the signature authorizes. The token/data
  // signing intents used below do not raise the wallet's consent screen (only
  // 'extrinsic' does -- see cefDdcSigner), so this is for self-documentation and
  // in case the wallet ever surfaces token-sign consent; it is not a popup.
  const signer = createDdcSigner(getSigner).describing('Authorize a DDC storage gateway credential');
  const info = await gateway.getInfo();

  const token = AuthToken.fullAccess({
    subject: gatewayPubKeyToSs58(info.gatewayPublicKey),
    canDelegate: true,
    expiresIn: DELEGATION_TOKEN_TTL_MS,
  });
  await token.sign(signer);
  const delegationToken = token.toString();

  const body = buildRegistrationBody(delegationToken, CREDENTIAL_LABEL);
  // 'data' intent: a plain message signature (no wallet consent screen, no
  // MultiSignature variant byte) -- the gateway verifies raw bytes.
  const signature = bytesToHex(await signer.sign(new TextEncoder().encode(body), 'data'));

  const tokenExpiresAt = Date.now() + DELEGATION_TOKEN_TTL_MS;
  const creds: GatewayCredentials = await gateway.registerCredentials({
    publicKey: hexWithPrefix(signer.publicKey),
    signature,
    signatureType: signer.type,
    delegationToken,
    label: CREDENTIAL_LABEL,
  });
  // The S3 credential can outlive -- or carry no expiry at all, in which case it
  // would read as "fresh forever" -- but the delegation token it rides on lapses
  // at DELEGATION_TOKEN_TTL_MS. Cap the effective expiry to the token's lifetime
  // so the credential is re-minted before the token dies (#188 review).
  return {
    ...creds,
    expiresAt: creds.expiresAt === undefined ? tokenExpiresAt : Math.min(creds.expiresAt, tokenExpiresAt),
  };
}

/**
 * Revoke this wallet's gateway credentials (DELETE /auth/credentials), so they
 * stop working at once rather than lapsing in up to 24h. Signed by the wallet
 * ('data' intent: a plain message signature, no consent screen), mirroring the
 * X-Public-Key / X-Signature auth that registration uses.
 *
 * NOT runtime-verified yet: confirm the exact signed message + method against the
 * live gateway (#188 review). The signed message here is the credential label; a
 * replay-protected scheme is a gateway-side TODO.
 */
export async function revokeGatewayCredential(getSigner: () => CefSigner, gateway: GatewayClient): Promise<void> {
  const signer = createDdcSigner(getSigner).describing('Revoke the DDC storage gateway credential');
  const signature = bytesToHex(await signer.sign(new TextEncoder().encode(CREDENTIAL_LABEL), 'data'));
  await gateway.deleteCredentials({
    publicKey: hexWithPrefix(signer.publicKey),
    signature,
    signatureType: signer.type,
  });
}
