import { describe, expect, it } from 'vitest';

import { fmtDateTime, fmtUtc, localZone, plural } from './format';

describe('times', () => {
  const at = '2026-11-25T01:02:08Z';
  it('say their zone, so they line up with the CLI’s UTC', () => {
    const zone = localZone(at);
    expect(zone).toMatch(/^(UTC|GMT([+-]\d{1,2}(:\d\d)?)?|[A-Z]{2,5})$/);
    expect(fmtDateTime(at).endsWith(zone)).toBe(true);
  });
  it('give the API’s own UTC form for a tooltip', () => {
    expect(fmtUtc(at)).toBe('2026-11-25T01:02:08Z');
    expect(fmtUtc(Date.parse('2026-11-25T01:02:08.120Z'))).toBe('2026-11-25T01:02:08Z');
  });
});

describe('plural', () => {
  it('counts one and many', () => {
    expect(plural(1, 'tool call')).toBe('1 tool call');
    expect(plural(0, 'tool call')).toBe('0 tool calls');
    expect(plural(3, 'model turn')).toBe('3 model turns');
  });
});
