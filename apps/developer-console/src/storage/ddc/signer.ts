/**
 * The CEF wallet session as a DDC signer for the storage slice.
 *
 * `createDdcSigner` wraps the session's `getSigner()` (src/wallet/session.tsx,
 * which returns the connected wallet's `CefSigner`) in a `CefDdcSigner`. The
 * resolver is lazy -- called per signing use -- so a signer built once stays
 * valid across reconnects, and building it does not require a live session.
 *
 * Signing actions that reach the chain ('extrinsic', e.g. createBucket) must
 * carry a human-readable consent string via `.describing(...)` at the call site;
 * Ulad reviews the exact wording (brief, Phase 0 step 2).
 */
import type { CefSigner } from '@cef-ai/wallet';
import { CefDdcSigner } from './cefDdcSigner';

/** Build a DDC signer from a per-use `CefSigner` resolver (e.g. `session.getSigner`). */
export function createDdcSigner(resolve: () => CefSigner): CefDdcSigner {
  return new CefDdcSigner(resolve);
}
