/**
 * Mint the developer's Inference API key (Phase 1).
 *
 * Ported from ROC (computeAuth.buildInferenceApiKey): a base58 DDC AuthToken the
 * developer pastes into an OpenAI/Anthropic-style client as a bearer credential.
 *   - NO subject  -> a true bearer (any holder may present it);
 *   - operations = [COMPUTE] only;
 *   - scoped to the on-chain numeric `bucketId` the usage bills to;
 *   - explicit expiry.
 * Signed by the connected wallet, which must own the bucket. Stateless: there is
 * no server record, so it CANNOT be revoked -- it only expires. Short TTL + show
 * once. The 'token' sign intent raises no wallet consent screen.
 */
import { AuthToken, type AuthTokenOperation } from '@cere-ddc-sdk/ddc';
import type { CefSigner } from '@cef-ai/wallet';
import { createDdcSigner } from '../storage/ddc/signer';

// `@cere-ddc-sdk/ddc`'s COMPUTE operation ordinal (ROC pins it as 4 to avoid a
// name-vs-value mismatch across SDK minors).
const COMPUTE_OPERATION = 4 as AuthTokenOperation;

export async function mintInferenceApiKey(
  getSigner: () => CefSigner,
  bucketId: bigint,
  expiresInMs: number,
): Promise<string> {
  const token = new AuthToken({ bucketId, operations: [COMPUTE_OPERATION], expiresIn: expiresInMs });
  await token.sign(createDdcSigner(getSigner));
  return token.toString();
}
