/**
 * Blockchain-index client for an account's bucket listing:
 *
 *     GET {blockchainIndexUrl}/v1/buckets?owner=0x...&after=...
 *
 * This is the drop-in replacement for the old Developer Console's
 * `account.ddc.getBucketList()` (cluster-apps/apps/developer-console
 * stores/AccountStore/resources.ts). That call is the SDK's only enumeration
 * path -- a full chain storage-map scan with no owner filter, no pagination and
 * no removed-bucket filtering. On today's network (500k+ buckets) it pulls
 * every bucket into the browser and SCALE-decodes them; it is not usable from a
 * page. The index answers the same question from a materialised view,
 * cursor-paginated and filtered server-side.
 *
 * Ported verbatim (logic) from ROC:
 *   roc/src/features/agentServiceAccess/ownerBuckets.ts
 * Differences: returns the bucket elements (not just ids) so the console can
 * hide removed buckets, and inlines the fetch-timeout helper instead of ROC's
 * `@/utils/withTimeout`.
 *
 * Not an authorization source. This only says which buckets an account owns;
 * access is always the on-chain owner plus the owner-signed roster.
 */

import { storageConfig } from '../storageConfig';

/** Contract version this client speaks. A mismatch is a hard error. */
const CONTRACT_VERSION = 1;

/** 15s read timeout, matching ROC's READ_FETCH_TIMEOUT_MS. */
const READ_FETCH_TIMEOUT_MS = 15_000;

function timeoutSignal(ms: number): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

/** Hex equality, prefix- and case-insensitive: neither is part of an identity. */
function sameHex(a: string, b: string): boolean {
  return a.replace(/^0x/i, '').toLowerCase() === b.replace(/^0x/i, '').toLowerCase();
}

export interface OwnerBucket {
  /** uint64 bucket id as a decimal string (never a JS number -- see guard below). */
  id: string;
  owner: string;
  hasBalance: boolean;
  isRemoved: boolean;
}

interface BucketElement {
  contractVersion: number;
  bucketId: number;
  owner: string;
  hasBalance: boolean;
  isRemoved: boolean;
}

interface OwnerBucketsResponse {
  contractVersion: number;
  owner: string;
  buckets: BucketElement[];
  /** Last id on this page; `0` means this was the last page. */
  nextAfter: number;
}

/**
 * Every bucket owned by `ownerPubkeyHex`, ascending by id.
 *
 * Pages are followed to exhaustion. `maxPages` is a runaway guard (a server
 * returning a non-advancing cursor), not a limit on the answer.
 */
export async function listOwnerBuckets(
  ownerPubkeyHex: string,
  options: { fetchImpl?: typeof fetch; maxPages?: number } = {},
): Promise<OwnerBucket[]> {
  const doFetch = options.fetchImpl ?? fetch;
  const maxPages = options.maxPages ?? 20;
  const base = storageConfig.blockchainIndexUrl.replace(/\/+$/, '');

  // Keyed by id so a repeated page (non-advancing cursor) cannot double-count.
  const byId = new Map<string, OwnerBucket>();
  let after = 0;

  for (let page = 0; page < maxPages; page++) {
    // owner is REQUIRED by the contract: unfiltered this route would mean every
    // bucket on the network, so the index answers 400 without it.
    const url =
      `${base}/v1/buckets?owner=${encodeURIComponent(ownerPubkeyHex)}` +
      (after ? `&after=${after}` : '');
    const res = await doFetch(url, { method: 'GET', signal: timeoutSignal(READ_FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      throw new Error(`GET ${url} failed: ${res.status}`);
    }
    const body = (await res.json()) as OwnerBucketsResponse;
    if (body.contractVersion !== CONTRACT_VERSION) {
      throw new Error(
        `blockchain index speaks contract version ${body.contractVersion}, this client ` +
          `speaks ${CONTRACT_VERSION}; field meanings cannot be assumed to match`,
      );
    }
    // Check the echoed owner rather than trusting it: an index answering about a
    // different account would otherwise have its buckets attributed here.
    if (!sameHex(body.owner, ownerPubkeyHex)) {
      throw new Error(`blockchain index answered for owner ${body.owner}, asked about ${ownerPubkeyHex}`);
    }

    for (const b of body.buckets) {
      if (!sameHex(b.owner, ownerPubkeyHex)) {
        throw new Error(`bucket ${b.bucketId} in the page is owned by ${b.owner}`);
      }
      // Bucket ids are uint64 on the wire and arrive as JSON numbers. Above 2^53
      // a double silently rounds to a DIFFERENT bucket. Refuse rather than guess.
      if (!Number.isSafeInteger(b.bucketId)) {
        throw new Error(`bucket id ${b.bucketId} exceeds the range a JSON number represents exactly`);
      }
      byId.set(String(b.bucketId), {
        id: String(b.bucketId),
        owner: b.owner,
        hasBalance: b.hasBalance,
        isRemoved: b.isRemoved,
      });
    }
    // 0 is the documented end-of-pages marker; a non-advancing cursor is a
    // server bug and the partial answer is still correct as far as it goes.
    if (!body.nextAfter || body.nextAfter <= after) break;
    after = body.nextAfter;
  }

  return [...byId.values()].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
}
