/**
 * The bucket an Inference API key bills to. A key is a DDC token scoped to an
 * on-chain bucket the signing wallet owns, so one is genuinely required; but
 * the console can make it, so a developer who only wants inference is never
 * sent to Storage first. The bucket is created the same way the Storage page
 * does (through the S3 gateway, which mints it on chain for the wallet), and
 * its numeric id is read back from the blockchain index once it shows up there.
 */
import type { OwnerBucket } from '~/storage/ddc/ownerBuckets';

/** How often, and how many times, the index is asked for the new bucket. */
export const BUCKET_POLL_MS = 2000;
export const BUCKET_POLL_ATTEMPTS = 30;

export const BUCKET_NOT_INDEXED = 'Your billing is still being set up. Try again in a minute.';

const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface BillingBucketDeps {
  /** The wallet's live buckets as last read (removed ones already dropped). */
  current: OwnerBucket[];
  /** Create a bucket for the wallet (AccountStore.createBucket: wallet consent, gateway, chain). */
  create: () => Promise<unknown>;
  /** Read the wallet's buckets from the index again. */
  list: () => Promise<OwnerBucket[]>;
  attempts?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** The id of the bucket a key bills to: the wallet's first one, or a new one. */
export async function ensureBillingBucket({
  current,
  create,
  list,
  attempts = BUCKET_POLL_ATTEMPTS,
  intervalMs = BUCKET_POLL_MS,
  sleep = sleepMs,
}: BillingBucketDeps): Promise<string> {
  const first = (bs: OwnerBucket[]) => bs.find((b) => !b.isRemoved)?.id ?? null;
  const have = first(current);
  if (have) return have;
  await create();
  for (let i = 0; i < attempts; i += 1) {
    const id = first(await list());
    if (id) return id;
    if (i < attempts - 1) await sleep(intervalMs);
  }
  throw new Error(BUCKET_NOT_INDEXED);
}
