import { describe, it, expect } from 'vitest';
import { listOwnerBuckets } from './ownerBuckets';

/**
 * `listOwnerBuckets` is an untrusted-boundary reader: it follows pages, checks the
 * echoed owner, refuses a contract-version drift, and refuses a bucket id that a
 * JSON number cannot hold exactly. A fake `fetchImpl` drives each path.
 */
const OWNER = '0xabcdef0123456789';

type Page = {
  contractVersion?: number;
  owner?: string;
  buckets?: Array<{ contractVersion?: number; bucketId: number; owner?: string; hasBalance?: boolean; isRemoved?: boolean }>;
  nextAfter?: number;
};

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return { ok: init.ok ?? true, status: init.status ?? 200, json: async () => body } as unknown as Response;
}

/** A fetchImpl that answers each call from `pages` in order and records the URLs. */
function pagedFetch(pages: Page[]) {
  const urls: string[] = [];
  let i = 0;
  const fetchImpl = (async (url: string) => {
    urls.push(String(url));
    const page = pages[i++] ?? pages[pages.length - 1];
    return jsonResponse({
      contractVersion: page.contractVersion ?? 1,
      owner: page.owner ?? OWNER,
      buckets: (page.buckets ?? []).map((b) => ({
        contractVersion: b.contractVersion ?? 1,
        bucketId: b.bucketId,
        owner: b.owner ?? OWNER,
        hasBalance: b.hasBalance ?? true,
        isRemoved: b.isRemoved ?? false,
      })),
      nextAfter: page.nextAfter ?? 0,
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, urls };
}

describe('listOwnerBuckets', () => {
  it('returns buckets as decimal-string ids, sorted ascending by numeric value', async () => {
    const { fetchImpl, urls } = pagedFetch([{ buckets: [{ bucketId: 10 }, { bucketId: 2 }], nextAfter: 0 }]);
    const out = await listOwnerBuckets(OWNER, { fetchImpl });
    expect(out.map((b) => b.id)).toEqual(['2', '10']);
    // owner is a required query param.
    expect(urls[0]).toContain(`owner=${encodeURIComponent(OWNER)}`);
  });

  it('follows pages to exhaustion and merges them', async () => {
    const { fetchImpl, urls } = pagedFetch([
      { buckets: [{ bucketId: 1 }], nextAfter: 1 },
      { buckets: [{ bucketId: 2 }], nextAfter: 0 },
    ]);
    const out = await listOwnerBuckets(OWNER, { fetchImpl });
    expect(out.map((b) => b.id)).toEqual(['1', '2']);
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain('after=1');
  });

  it('de-duplicates by id and stops on a non-advancing cursor', async () => {
    // nextAfter never advances past `after`; the loop must break, not spin.
    const { fetchImpl, urls } = pagedFetch([
      { buckets: [{ bucketId: 5 }], nextAfter: 0 },
    ]);
    const out = await listOwnerBuckets(OWNER, { fetchImpl });
    expect(out.map((b) => b.id)).toEqual(['5']);
    expect(urls).toHaveLength(1);
  });

  it('accepts an echoed owner that differs only by 0x prefix / case', async () => {
    const { fetchImpl } = pagedFetch([{ owner: 'ABCDEF0123456789', buckets: [{ bucketId: 1, owner: 'abcdef0123456789' }], nextAfter: 0 }]);
    const out = await listOwnerBuckets(OWNER, { fetchImpl });
    expect(out.map((b) => b.id)).toEqual(['1']);
  });

  it('throws on a non-ok response, naming the status', async () => {
    const fetchImpl = (async () => jsonResponse({}, { ok: false, status: 503 })) as unknown as typeof fetch;
    await expect(listOwnerBuckets(OWNER, { fetchImpl })).rejects.toThrow(/503/);
  });

  it('throws on a contract-version mismatch', async () => {
    const { fetchImpl } = pagedFetch([{ contractVersion: 2, buckets: [], nextAfter: 0 }]);
    await expect(listOwnerBuckets(OWNER, { fetchImpl })).rejects.toThrow(/contract version/i);
  });

  it('throws when the index answers for a different owner', async () => {
    const { fetchImpl } = pagedFetch([{ owner: '0xdeadbeef', buckets: [], nextAfter: 0 }]);
    await expect(listOwnerBuckets(OWNER, { fetchImpl })).rejects.toThrow(/answered for owner/i);
  });

  it('throws when a bucket in the page is owned by someone else', async () => {
    const { fetchImpl } = pagedFetch([{ buckets: [{ bucketId: 1, owner: '0xdeadbeef' }], nextAfter: 0 }]);
    await expect(listOwnerBuckets(OWNER, { fetchImpl })).rejects.toThrow(/owned by/i);
  });

  it('refuses a bucket id beyond the exact-integer range of a JSON number', async () => {
    const { fetchImpl } = pagedFetch([{ buckets: [{ bucketId: Number.MAX_SAFE_INTEGER + 1 }], nextAfter: 0 }]);
    await expect(listOwnerBuckets(OWNER, { fetchImpl })).rejects.toThrow(/exceeds the range/i);
  });
});
