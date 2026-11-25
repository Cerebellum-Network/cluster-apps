import { describe, expect, it } from 'vitest';

import {
  coverageBlocks,
  coverageProblem,
  credentialCoverage,
  secretCoversRule,
  secretHostMatches,
} from './egressCoverage';
import type { SecretSummary } from './types';

const secret = (name: string, hosts?: string[]): SecretSummary => ({
  name,
  type: 'header',
  header: 'Authorization',
  ...(hosts ? { hosts } : {}),
  created_at: '2026-11-25T00:00:00Z',
  updated_at: '2026-11-25T00:00:00Z',
});

// The cases of ddc-node cluster/egress-proxy/api (SecretHostMatches, SecretCoversRule).
describe('secretHostMatches', () => {
  it.each([
    ['api.github.com', 'api.github.com', true],
    ['API.github.com.', 'api.github.com', true],
    ['api.github.com', 'github.com', false],
    ['*.example.com', 'a.example.com', true],
    ['*.example.com', 'a.b.example.com', false],
    ['*.example.com', 'example.com', false],
    ['*.example.com', '.example.com', false],
    ['', 'a.example.com', false],
  ])('%s against %s: %s', (pattern, host, want) => {
    expect(secretHostMatches(pattern, host)).toBe(want);
  });
});

describe('secretCoversRule', () => {
  it('covers an exact rule host by name or by one of its wildcards', () => {
    expect(secretCoversRule(['api.github.com'], 'api.github.com')).toBe(true);
    expect(secretCoversRule(['*.github.com'], 'api.github.com')).toBe(true);
    expect(secretCoversRule(['api.github.com'], 'uploads.github.com')).toBe(false);
  });
  it('covers a wildcard rule host only with the same wildcard', () => {
    expect(secretCoversRule(['*.github.com'], '*.github.com')).toBe(true);
    expect(secretCoversRule(['api.github.com'], '*.github.com')).toBe(false);
    expect(secretCoversRule(['*.api.github.com'], '*.github.com')).toBe(false);
  });
});

describe('credentialCoverage', () => {
  const have = [secret('gh', ['api.github.com']), secret('old', []), secret('legacy')];

  it('tells each case apart', () => {
    expect(credentialCoverage('', 'x.org', have)).toEqual({ state: 'none' });
    expect(credentialCoverage('gh', 'api.github.com', undefined)).toEqual({ state: 'unknown' });
    expect(credentialCoverage('nope', 'x.org', have)).toEqual({ state: 'missing', name: 'nope' });
    expect(credentialCoverage('legacy', 'x.org', have)).toEqual({ state: 'unlisted', name: 'legacy' });
    expect(credentialCoverage('old', 'x.org', have)).toEqual({ state: 'unbound', name: 'old' });
    expect(credentialCoverage('gh', 'API.GitHub.com', have)).toEqual({
      state: 'covered',
      name: 'gh',
      hosts: ['api.github.com'],
    });
    expect(credentialCoverage('gh', 'github.com', have)).toEqual({
      state: 'not-covered',
      name: 'gh',
      hosts: ['api.github.com'],
      host: 'github.com',
    });
  });

  it('blocks exactly what the gateway refuses or what would be sent nowhere', () => {
    const states = [
      credentialCoverage('', 'x.org', have),
      credentialCoverage('gh', 'x.org', undefined),
      credentialCoverage('nope', 'x.org', have),
      credentialCoverage('legacy', 'x.org', have),
      credentialCoverage('old', 'x.org', have),
      credentialCoverage('gh', 'api.github.com', have),
      credentialCoverage('gh', 'github.com', have),
    ];
    expect(states.map(coverageBlocks)).toEqual([false, false, true, false, true, false, true]);
  });

  it('says which hosts to store the secret with', () => {
    const msg = coverageProblem(credentialCoverage('gh', 'github.com', have));
    expect(msg).toContain('credential_not_bound');
    expect(msg).toContain('api.github.com, github.com');
    expect(coverageProblem(credentialCoverage('nope', 'x.org', have))).toContain('unknown_credential');
    expect(coverageProblem(credentialCoverage('gh', 'api.github.com', have))).toBeNull();
  });
});
