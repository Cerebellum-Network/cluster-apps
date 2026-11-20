import { describe, it, expect } from 'vitest';

import {
  dropUsageToken,
  readUsageToken,
  usageTokenKey,
  writeUsageToken,
  USAGE_TOKEN_MARGIN_MS,
  type TokenStorage,
} from './usageToken';

const fakeStorage = (): TokenStorage & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
};

describe('usage token cache', () => {
  it('is per account and bucket', () => {
    const s = fakeStorage();
    writeUsageToken('acc1', '7', 'tok', 10_000_000, s);
    expect(readUsageToken('acc1', '7', 0, s)).toBe('tok');
    expect(readUsageToken('acc1', '8', 0, s)).toBeNull();
    expect(readUsageToken('acc2', '7', 0, s)).toBeNull();
  });

  it('forgets a token within the safety margin of its expiry', () => {
    const s = fakeStorage();
    writeUsageToken('a', '1', 'tok', 1_000_000, s);
    expect(readUsageToken('a', '1', 1_000_000 - USAGE_TOKEN_MARGIN_MS - 1, s)).toBe('tok');
    expect(readUsageToken('a', '1', 1_000_000 - USAGE_TOKEN_MARGIN_MS, s)).toBeNull();
    expect(s.map.has(usageTokenKey('a', '1'))).toBe(false);
  });

  it('drops a token on demand and ignores garbage', () => {
    const s = fakeStorage();
    writeUsageToken('a', '1', 'tok', 10_000_000, s);
    dropUsageToken('a', '1', s);
    expect(readUsageToken('a', '1', 0, s)).toBeNull();
    s.setItem(usageTokenKey('a', '1'), '{not json');
    expect(readUsageToken('a', '1', 0, s)).toBeNull();
  });

  it('works without storage', () => {
    expect(readUsageToken('a', '1', 0, null)).toBeNull();
    expect(() => writeUsageToken('a', '1', 't', 1, null)).not.toThrow();
  });
});
