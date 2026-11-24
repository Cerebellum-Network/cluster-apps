import { describe, expect, it } from 'vitest';

import { parseAgentDefinition, validateAgentDefinition } from './agentDefinition';
import { listAgents, saveAgent } from './agentStore';
import { ulid, ULID_RE } from './ulid';
import { fmtUnits, sumUnits } from './format';

const GOOD = {
  schema: 'cere.agent/v1',
  name: 'research',
  harness: 'claude-code',
  image: 'cerebellumnetwork/ddc-agent-runner:0.1.0',
  model: {
    base_url: 'https://inference-gateway.compute.test.ddcdragon.com/anthropic',
    model: 'm',
    credential: 'ddc-inference',
  },
  tools: ['Read', 'WebFetch'],
  egress: { allow: [{ host: 'gvisor.dev', methods: ['GET'] }] },
  timeout_s: 900,
};

describe('validateAgentDefinition', () => {
  it('accepts the contract example', () => {
    expect(validateAgentDefinition(GOOD)).toEqual([]);
  });
  it('names each problem', () => {
    const errs = validateAgentDefinition({
      ...GOOD,
      schema: 'x',
      name: 'Bad Name',
      harness: 'container',
      model: { base_url: 'nope' },
      egress: { allow: [{ host: 'a', methods: ['get'] }] },
    });
    expect(errs.join('\n')).toMatch(/schema/);
    expect(errs.join('\n')).toMatch(/"name"/);
    expect(errs.join('\n')).toMatch(/"command" is required/);
    expect(errs.join('\n')).toMatch(/base_url/);
    expect(errs.join('\n')).toMatch(/upper-case/);
  });
  it('parses text and reports bad JSON', () => {
    expect(parseAgentDefinition(JSON.stringify(GOOD)).def?.name).toBe('research');
    expect(parseAgentDefinition('{').errors[0]).toMatch(/Not valid JSON/);
  });
});

describe('agent store over a bucket', () => {
  /** An in-memory stand-in for the S3 gateway's object API (test only). */
  function memoryBuckets(init: Record<string, Record<string, string>>) {
    const data = init;
    return {
      data,
      listObjects: async (bucket: string, prefix?: string) =>
        Object.keys(data[bucket] ?? {})
          .filter((k) => !prefix || k.startsWith(prefix))
          .map((key) => ({ key, size: data[bucket][key].length })),
      readObject: async (bucket: string, key: string) => new Blob([data[bucket][key]]),
      uploadObject: async (i: { bucketName: string; key: string; body: Blob | Uint8Array | string }) => {
        data[i.bucketName] = { ...(data[i.bucketName] ?? {}), [i.key]: String(i.body) };
      },
      deleteObject: async (bucket: string, key: string) => {
        delete data[bucket][key];
      },
    };
  }

  it('reads definitions from every bucket and flags the broken ones', async () => {
    const s = memoryBuckets({
      a: { 'cere/agents/research.json': JSON.stringify(GOOD), 'cere/agents/x/nested.json': '{}', 'other.json': '{}' },
      b: { 'cere/agents/sre.json': JSON.stringify({ ...GOOD, name: 'other' }), 'cere/agents/bad.json': '{' },
    });
    const { agents, failed } = await listAgents(s, ['a', 'b']);
    expect(failed).toEqual([]);
    expect(agents.map((a) => [a.bucket, a.name, !!a.def])).toEqual([
      ['b', 'bad', false],
      ['b', 'other', false],
      ['a', 'research', true],
    ]);
  });

  it('writes a definition at cere/agents/<name>.json', async () => {
    const s = memoryBuckets({ a: {} });
    const key = await saveAgent(s, 'a', GOOD as never);
    expect(key).toBe('cere/agents/research.json');
    expect(JSON.parse(s.data.a[key])).toEqual(GOOD);
  });
});

describe('ulid', () => {
  it('is 26 lowercase Crockford characters, time first', () => {
    const a = ulid(1_700_000_000_000, () => new Uint8Array(10));
    expect(a).toMatch(ULID_RE);
    expect(a.slice(10)).toBe('0'.repeat(16));
    expect(ulid(1_700_000_000_001) > a).toBe(true);
  });
});

describe('DAC units', () => {
  it('formats and sums decimal strings exactly past 2^53', () => {
    expect(fmtUnits('1248000000000')).toBe('1,248,000,000,000');
    expect(sumUnits(['9007199254740993', '1'])).toBe('9007199254740994');
  });
});
