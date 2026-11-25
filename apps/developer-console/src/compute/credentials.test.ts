import { describe, expect, it } from 'vitest';

import {
  bucketSecrets,
  credentialsFor,
  credentialsOfSandbox,
  emptyOwnSecret,
  ownSecretsFromForms,
  sandboxUses,
  secretAgents,
} from './credentials';
import { credentialCoverage, coverageProblem, rulesBlocked } from './egressCoverage';
import type { Sandbox, SecretSummary } from './types';

const at = '2026-11-25T00:00:00Z';
const secret = (name: string, hosts: string[], agent?: string): SecretSummary => ({
  name,
  type: 'header',
  header: 'Authorization',
  hosts,
  ...(agent ? { agent } : {}),
  created_at: at,
  updated_at: at,
});

// GET /v1/secrets as devnet answers it: the bucket's and an agent's of the same name.
const all = [
  secret('github', ['api.github.com']),
  secret('github', ['api.github.com', 'httpbin.org'], 'sre'),
  secret('ddc-inference', ['inference-gateway.compute.dev.ddcdragon.com']),
];

describe('credentialsFor', () => {
  it('resolves a name narrowest first: the sandbox’s own, then its agent’s, then the bucket’s', () => {
    const own = [{ name: 'github', header: 'Authorization', hosts: ['api.github.com'] }];
    const creds = credentialsFor(all, { own, agent: 'sre' })!;
    expect(creds.map((c) => `${c.name}:${c.scope}`)).toEqual(['github:sandbox', 'ddc-inference:bucket']);
    expect(creds[0].overrides).toEqual(['agent', 'bucket']);
    expect(credentialsFor(all, { agent: 'sre' })!.find((c) => c.name === 'github')).toMatchObject({
      scope: 'agent',
      agent: 'sre',
      hosts: ['api.github.com', 'httpbin.org'],
    });
    // Another agent's secret is not this sandbox's.
    expect(credentialsFor(all, { agent: 'research' })!.find((c) => c.name === 'github')?.scope).toBe('bucket');
    expect(credentialsFor(undefined)).toBeUndefined();
  });

  it('checks a rule against the secret that will be used', () => {
    const forAgent = credentialsFor(all, { agent: 'sre' });
    expect(credentialCoverage('github', 'httpbin.org', forAgent).state).toBe('covered');
    expect(credentialCoverage('github', 'httpbin.org', bucketSecrets(all)).state).toBe('not-covered');
    const own = credentialsFor(all, { own: [{ name: 'slack-a', header: 'Authorization', hosts: ['mcp.slack.com'] }] });
    const c = credentialCoverage('slack-a', 'api.slack.com', own);
    expect(c).toMatchObject({ state: 'not-covered', scope: 'sandbox' });
    expect(coverageProblem(c)).toContain('keeps the hosts it was created with');
  });

  it('checks every name a placeholder rule lets the sandbox pick', () => {
    const own = credentialsFor(all, { own: [{ name: 'slack-a', header: 'Authorization', hosts: ['mcp.slack.com'] }] });
    expect(rulesBlocked([{ host: 'mcp.slack.com', placeholders: ['slack-a'] }], own)).toBe(false);
    expect(rulesBlocked([{ host: 'mcp.slack.com', placeholders: ['slack-a', 'slack-b'] }], own)).toBe(true);
  });
});

describe('the bucket’s secrets list', () => {
  it('names the agents that hold secrets and counts a running sandbox only where the name resolves to it', () => {
    expect(secretAgents(all)).toEqual(['sre']);
    const run = {
      labels: { 'cere.agent': 'sre' },
      egress: { allow: [{ host: 'api.github.com', methods: ['GET'], credential: 'github' }] },
    } as unknown as Sandbox;
    expect(sandboxUses(run, all[1], all)).toBe(true);
    expect(sandboxUses(run, all[0], all)).toBe(false);
    const plain = { ...run, labels: {} } as Sandbox;
    expect(sandboxUses(plain, all[0], all)).toBe(true);
    expect(sandboxUses(plain, all[1], all)).toBe(false);
    expect(credentialsOfSandbox(all, run)?.[0]).toMatchObject({ name: 'github', scope: 'agent' });
  });
});

describe('ownSecretsFromForms', () => {
  it('builds the create body’s secrets, a bearer token as Bearer <value>', () => {
    const r = ownSecretsFromForms([
      { ...emptyOwnSecret(), name: 'gh', hosts: 'api.github.com, uploads.github.com', value: 't0k' },
      { name: 'key', header: 'X-Api-Key', hosts: 'httpbin.org', value: 'v', bearer: true },
    ]);
    expect(r.ok).toBe(true);
    expect(r.secrets).toEqual([
      {
        name: 'gh',
        type: 'header',
        header: 'Authorization',
        value: 'Bearer t0k',
        hosts: ['api.github.com', 'uploads.github.com'],
      },
      { name: 'key', type: 'header', header: 'X-Api-Key', value: 'v', hosts: ['httpbin.org'] },
    ]);
  });

  it('says what is wrong with each', () => {
    const r = ownSecretsFromForms([
      { ...emptyOwnSecret(), name: 'Bad', hosts: 'a.b', value: 'x' },
      { ...emptyOwnSecret(), name: 'gh', hosts: '', value: 'x' },
      { ...emptyOwnSecret(), name: 'gh2', hosts: 'https://a.b/', value: 'x' },
      { ...emptyOwnSecret(), name: 'gh3', hosts: 'a.b', value: '' },
      { ...emptyOwnSecret(), name: 'gh3', hosts: 'a.b', value: 'y' },
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual([
      'A name of lowercase letters, digits and dashes.',
      'The hosts it may be sent to.',
      '“https://a.b/” is not a host name. Use names like api.github.com, not URLs.',
      'Its value.',
      'gh3 is listed twice.',
    ]);
  });
});
