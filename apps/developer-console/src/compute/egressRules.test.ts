import { describe, expect, it } from 'vitest';

import {
  ANY_METHOD,
  allowedNow,
  emptyRule,
  formFromRule,
  ruleFromForm,
  rulesFromForms,
  sameRules,
  allowRule,
  denials,
  matchRule,
  pathUnder,
  requestedMethod,
  ruleHostMatches,
  ruleProblem,
} from './egressRules';
import type { EgressEntry, EgressRule } from './types';

// The cases of ddc-node cluster/egress-proxy/policy (HostMatches, PathUnder, Match).
describe('ruleHostMatches', () => {
  it.each([
    ['api.github.com', 'api.github.com', true],
    ['API.github.com.', 'api.github.com', true],
    ['api.github.com', 'github.com', false],
    ['*.example.com', 'a.example.com', true],
    // Unlike a secret's hosts, a rule's wildcard admits any depth.
    ['*.example.com', 'a.b.example.com', true],
    ['*.example.com', 'example.com', false],
    ['*.example.com', '', false],
  ])('%s against %s is %s', (pattern, host, want) => {
    expect(ruleHostMatches(pattern, host)).toBe(want);
  });
});

describe('pathUnder', () => {
  it.each([
    ['/repos/org/app', undefined, true],
    ['/x', '/', true],
    ['/repos/org/app', '/repos/org/app', true],
    ['/repos/org/app/x', '/repos/org/app', true],
    ['/repos/org/app-private', '/repos/org/app', false],
    ['/pypi/x', '/pypi/', true],
    ['/pypi', '/pypi/', false],
  ])('%s under %s is %s', (path, prefix, want) => {
    expect(pathUnder(path, prefix)).toBe(want);
  });
});

const rules: EgressRule[] = [
  { host: 'api.github.com', methods: ['GET'], path_prefix: '/repos/org', credential: 'gh' },
  { host: '*.pypi.org', methods: ['*' as never] },
];

describe('matchRule', () => {
  it('matches host, path and method, and never TRACE or CONNECT', () => {
    expect(matchRule(rules, 'api.github.com', 'get', '/repos/org/x')?.credential).toBe('gh');
    expect(matchRule(rules, 'api.github.com', 'POST', '/repos/org/x')).toBeNull();
    expect(matchRule(rules, 'api.github.com', 'GET', '/users')).toBeNull();
    expect(matchRule(rules, 'files.pypi.org', 'PUT', '/a')).not.toBeNull();
    expect(matchRule(rules, 'files.pypi.org', 'TRACE', '/a')).toBeNull();
  });
});

const entry = (over: Partial<EgressEntry>): EgressEntry => ({
  id: 1,
  ts: '2026-11-25T10:00:00Z',
  bucket: 4116,
  sandbox_id: 'sb-1',
  node: null,
  host: 'example.com',
  method: 'CONNECT',
  path: null,
  status: 403,
  decision: 'denied',
  reason: 'host not allowed',
  credential: null,
  bytes_up: 0,
  bytes_down: 0,
  duration_ms: null,
  ...over,
});

describe('allowedNow', () => {
  it('lets a CONNECT refusal through once any rule names its host', () => {
    expect(allowedNow([], entry({}))).toBe(false);
    expect(allowedNow([{ host: 'example.com', methods: ['POST'] }], entry({}))).toBe(true);
  });
  it('checks method and path of a request refused inside a tunnel', () => {
    const e = entry({ method: 'POST', path: '/v1/x' });
    expect(allowedNow([{ host: 'example.com', methods: ['GET'] }], e)).toBe(false);
    expect(allowedNow([{ host: 'example.com', methods: ['GET', 'POST'] }], e)).toBe(true);
  });
});

describe('requestedMethod', () => {
  it('reads a bare CONNECT as GET and keeps a real method', () => {
    expect(requestedMethod(entry({}))).toBe('GET');
    expect(requestedMethod(entry({ method: 'post', path: '/' }))).toBe('POST');
  });
});

describe('allowRule', () => {
  it('adds methods to a rule with the same host, path prefix and credential', () => {
    const out = allowRule(rules, {
      host: 'API.github.com',
      methods: ['post'] as never,
      path_prefix: '/repos/org',
      credential: 'gh',
    });
    expect(out).toHaveLength(2);
    expect(out[0].methods).toEqual(['GET', 'POST']);
  });
  it('puts a different rule first, so it decides ahead of an older one for the same host', () => {
    const out = allowRule(rules, { host: 'api.github.com', methods: ['GET'], credential: 'other' });
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ host: 'api.github.com', methods: ['GET'], credential: 'other' });
    expect(out.slice(1)).toEqual(rules);
  });
  it('drops empty optional fields', () => {
    expect(allowRule([], { host: 'example.com', methods: ['GET'], path_prefix: '', credential: '' })).toEqual([
      { host: 'example.com', methods: ['GET'] },
    ]);
  });
});

describe('denials', () => {
  it('groups denied requests by sandbox and host, newest first, without what the rules allow now', () => {
    const list = denials(
      [
        entry({ id: 1, ts: '2026-11-25T10:00:00Z' }),
        entry({ id: 2, ts: '2026-11-25T10:00:05Z', method: 'POST', path: '/x', host: 'Example.com' }),
        entry({ id: 3, ts: '2026-11-25T10:00:01Z', host: 'b.org' }),
        entry({ id: 4, ts: '2026-11-25T10:00:09Z', host: 'allowed.org' }),
        entry({ id: 5, decision: 'allowed', host: 'c.org' }),
        entry({ id: 6, sandbox_id: 'sb-2' }),
      ],
      (id) => (id === 'sb-1' ? [{ host: 'allowed.org', methods: ['GET'] }] : null),
    );
    expect(list.map((d) => [d.sandboxId, d.host, d.count, d.methods])).toEqual([
      ['sb-1', 'example.com', 2, ['GET', 'POST']],
      ['sb-1', 'b.org', 1, ['GET']],
      ['sb-2', 'example.com', 1, ['GET']],
    ]);
    expect(list[0].entry.id).toBe(2);
  });
});

describe('ruleProblem', () => {
  it.each([
    [{ host: 'api.github.com', methods: ['GET'] }, null],
    [{ host: '*.example.com', methods: ['GET'] }, null],
    [{ host: 'https://api.github.com', methods: ['GET'] }, 'not a host name'],
    [{ host: 'localhost', methods: ['GET'] }, 'not a host name'],
    [{ host: '', methods: ['GET'] }, 'Name a host'],
    [{ host: 'a.com', methods: [] }, 'at least one method'],
    [{ host: 'a.com', methods: ['TRACE'] }, 'never forwarded'],
    [{ host: 'a.com', methods: ['GET'], path_prefix: 'x' }, 'starts with'],
  ] as const)('%j', (rule, want) => {
    const got = ruleProblem(rule as never);
    if (want === null) expect(got).toBeNull();
    else expect(got).toContain(want);
  });
});

describe('rule forms', () => {
  it('round-trips a rule and keeps any-method as just *', () => {
    const r: EgressRule = { host: 'api.github.com', methods: ['POST', 'GET'], path_prefix: '/repos', credential: 'gh' };
    expect(ruleFromForm(formFromRule(r))).toEqual({ ...r, methods: ['GET', 'POST'] });
    expect(ruleFromForm({ host: ' Example.COM. ', methods: ['GET', ANY_METHOD], path: ' ', credential: '' })).toEqual({
      host: 'example.com',
      methods: [ANY_METHOD],
    });
  });
  it('says which form is wrong', () => {
    const out = rulesFromForms([emptyRule('a.com'), emptyRule('https://b.com'), emptyRule('c.com', [])]);
    expect(out.ok).toBe(false);
    expect(out.errors[0]).toBeUndefined();
    expect(out.errors[1]).toContain('not a host name');
    expect(out.errors[2]).toContain('method');
  });
  it('compares allow-lists by what they say', () => {
    expect(
      sameRules([{ host: 'A.com', methods: ['POST', 'GET'] }], [{ host: 'a.com', methods: ['GET', 'POST'] }]),
    ).toBe(true);
    expect(
      sameRules([{ host: 'a.com', methods: ['GET'] }], [{ host: 'a.com', methods: ['GET'], credential: 'x' }]),
    ).toBe(false);
  });
});
