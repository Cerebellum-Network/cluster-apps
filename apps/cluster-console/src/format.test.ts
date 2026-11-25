import { describe, expect, it } from 'vitest';

import { ago, bytes, chosenNode, groupBy, mib, num, seconds, shortKey, timeColumn } from './format';

describe('format', () => {
  it('shortens keys', () => {
    expect(shortKey('0c854df7a1742d2e2d932686374ed53ad89d3e9fb43ba010469c02bfb96eaa4c')).toBe('0c854d…aa4c');
    expect(shortKey('0xabc')).toBe('abc');
    expect(shortKey(null)).toBe('—');
  });
  it('formats sizes and numbers', () => {
    expect(mib(512)).toBe('512 MiB');
    expect(mib(8192)).toBe('8 GiB');
    expect(mib(null)).toBe('—');
    expect(bytes(18231)).toBe('18.2 KB');
    expect(bytes(0)).toBe('0 B');
    expect(num(1234.56)).toBe('1,234.6');
    expect(num(undefined)).toBe('—');
  });
  it('formats durations and ages', () => {
    expect(seconds(5.24)).toBe('5.2s');
    expect(seconds(125)).toBe('2m 5s');
    expect(seconds(3720)).toBe('1h 2m');
    const now = Date.parse('2026-11-25T10:00:00Z');
    expect(ago('2026-11-25T09:59:48Z', now)).toBe('12 s ago');
    expect(ago('2026-11-25T09:30:00Z', now)).toBe('30 min ago');
  });
  it('groups in first-seen order', () => {
    expect(groupBy([{ n: 'b' }, { n: 'a' }, { n: 'b' }], (x) => x.n).map(([k, v]) => [k, v.length])).toEqual([
      ['b', 2],
      ['a', 1],
    ]);
  });
  it('finds the node a placement chose', () => {
    expect(
      chosenNode(
        {
          attempts: [
            { node: 'x', result: 'error' },
            { node: 'y', result: 'accepted' },
          ],
        },
        'z',
      ),
    ).toBe('y');
    expect(chosenNode({ attempts: [] }, 'z')).toBe('z');
    expect(chosenNode(null, null)).toBeNull();
  });
});

describe('timeColumn', () => {
  it('keeps one unit down a column, from its largest amount', () => {
    const f = timeColumn(176, 'GiB');
    expect([f(150), f(26), f(176)]).toEqual(['2.5 GiB-min', '0.4 GiB-min', '2.9 GiB-min']);
    expect(timeColumn(30, 'vCPU')(0.1)).toBe('0.1 vCPU-s');
    expect(timeColumn(7200, 'vCPU')(900)).toBe('0.3 vCPU-h');
  });
});
