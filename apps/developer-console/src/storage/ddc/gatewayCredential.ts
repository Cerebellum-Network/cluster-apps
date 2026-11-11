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
  const signer = createDdcSigner(getSigner);
  const info = await gateway.getInfo();

  const token = AuthToken.fullAccess({ subject: gatewayPubKeyToSs58(info.gatewayPublicKey), canDelegate: true });
  await token.sign(signer);
  const delegationToken = token.toString();

  const body = buildRegistrationBody(delegationToken, CREDENTIAL_LABEL);
  // 'data' intent: a plain message signature (no wallet consent screen, no
  // MultiSignature variant byte) -- the gateway verifies raw bytes.
  const signature = bytesToHex(await signer.sign(new TextEncoder().encode(body), 'data'));

  return gateway.registerCredentials({
    publicKey: hexWithPrefix(signer.publicKey),
    signature,
    signatureType: signer.type,
    delegationToken,
    label: CREDENTIAL_LABEL,
  });
}
