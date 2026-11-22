import { describe, it, expect, vi } from 'vitest';

import type { OwnerBucket } from '../storage/ddc/ownerBuckets';
import { ensureBillingBucket, BUCKET_NOT_INDEXED } from './billingBucket';

const bucket = (id: string, isRemoved = false): OwnerBucket => ({ id, owner: '0xab', hasBalance: true, isRemoved });
const noSleep = () => Promise.resolve();

describe('ensureBillingBucket', () => {
  it('uses the first live bucket and creates nothing', async () => {
    const create = vi.fn();
    const id = await ensureBillingBucket({ current: [bucket('7', true), bucket('9')], create, list: vi.fn(), sleep: noSleep });
    expect(id).toBe('9');
    expect(create).not.toHaveBeenCalled();
  });

  it('creates one when there is none, then waits for the index to show it', async () => {
    const create = vi.fn().mockResolvedValue('bucket-name');
    const list = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([bucket('3', true)]).mockResolvedValueOnce([bucket('42')]);
    const sleep = vi.fn(noSleep);
    expect(await ensureBillingBucket({ current: [], create, list, sleep, intervalMs: 5 })).toBe('42');
    expect(create).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(5);
  });

  it('gives up with a retry message when the index never shows it', async () => {
    const list = vi.fn().mockResolvedValue([]);
    await expect(ensureBillingBucket({ current: [], create: vi.fn(), list, attempts: 3, sleep: noSleep })).rejects.toThrow(BUCKET_NOT_INDEXED);
    expect(list).toHaveBeenCalledTimes(3);
  });

  it('does not mint against a bucket when creating it failed', async () => {
    const list = vi.fn();
    await expect(ensureBillingBucket({ current: [], create: () => Promise.reject(new Error('rejected in wallet')), list, sleep: noSleep })).rejects.toThrow('rejected in wallet');
    expect(list).not.toHaveBeenCalled();
  });
});
