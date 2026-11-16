/**
 * The developer's **Inference API key** — a base58 DDC access token they paste
 * into an OpenAI/Anthropic SDK (or curl) as a Bearer credential.
 *
 * Ported from ROC (src/features/account/computeAuth.ts). Shape — a one-level
 * chain rooted in the bucket owner:
 *   - NO `subject`, so any holder may present it (a true bearer);
 *   - `operations = [COMPUTE]` only (never full access: the DAC chain walker
 *     attenuates strictly, and "full access" {PUT,GET,DELETE} does not contain
 *     COMPUTE, so a widened token fails the runtime's COMPUTE check);
 *   - scoped to `bucketId`, the bucket usage bills to;
 *   - explicit expiry.
 *
 * Signed by the connected wallet, which must be the bucket's on-chain owner: the
 * compute authorizer resolves the chain's root issuer and reads the bucket's
 * live owner per request, so a token signed by anyone else — or one whose bucket
 * is later transferred — stops being accepted. Stateless: there is no server
 * record, so it cannot be revoked individually, it only expires.
 */
import { AuthToken, type AuthTokenOperation } from '@cere-ddc-sdk/ddc';
import type { Signer } from '@cere-ddc-sdk/blockchain';

/**
 * DDC `Operation.COMPUTE` — wire value 4. The generated `Operation` enum on
 * `@cere-ddc-sdk` 3.x is `UNKNOWN=0, PUT=1, GET=2, DELETE=3` and has no COMPUTE
 * member yet; the runtime encoder writes `operations` as a packed varint and does
 * not validate against the enum, so the value encodes byte-correctly and only the
 * TypeScript type is behind, hence the cast. Source of truth: ddc-node
 * `ddc-dac/pb` `Operation_COMPUTE = 4`.
 */
export const COMPUTE_OPERATION = 4 as AuthTokenOperation;

/** The operation set every compute-path token carries — COMPUTE and nothing else. */
export const COMPUTE_OPERATIONS: readonly AuthTokenOperation[] = [COMPUTE_OPERATION];

/**
 * Build + sign a COMPUTE-only bearer Inference API key for `bucketId`. `signer`
 * must be the bucket owner's wallet. Returns the base58 token string.
 */
export async function buildInferenceApiKey(
  signer: Signer,
  { bucketId, expiresInMs }: { bucketId: bigint; expiresInMs: number },
): Promise<string> {
  const token = new AuthToken({
    bucketId,
    operations: [...COMPUTE_OPERATIONS],
    expiresIn: expiresInMs,
  });
  await token.sign(signer);
  return token.toString();
}
