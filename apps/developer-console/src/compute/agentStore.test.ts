import { describe, expect, it } from 'vitest';

import { bucketList, bucketNames } from './agentStore';

describe('bucketList', () => {
  it('is loading until the first listing answers', () => {
    expect(bucketList(undefined, null)).toEqual({ state: 'loading' });
    expect(bucketNames(bucketList(undefined, null))).toBeUndefined();
  });

  it('reads an empty listing as no buckets', () => {
    const l = bucketList([], null);
    expect(l).toEqual({ state: 'ok', names: [] });
    expect(bucketNames(l)).toEqual([]);
  });

  it('never reads a failed listing as no buckets', () => {
    // AccountStore.refreshBuckets leaves [] behind when the first listing fails.
    const l = bucketList([], 'not signed in');
    expect(l).toEqual({ state: 'unreadable', error: 'not signed in' });
    expect(bucketNames(l)).toEqual([]);
  });

  it('keeps the earlier list when a refresh fails, and says so', () => {
    const l = bucketList([{ name: 'dc-a' }, { name: 'dc-b' }], 'gateway 503');
    expect(l).toEqual({ state: 'stale', names: ['dc-a', 'dc-b'], error: 'gateway 503' });
    expect(bucketNames(l)).toEqual(['dc-a', 'dc-b']);
  });
});
