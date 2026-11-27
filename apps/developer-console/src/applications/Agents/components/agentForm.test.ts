import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseAgentDefinition } from '../../../compute/agentDefinition';
import type { SecretSummary } from '../../../compute/types';
import { AGENT_EXAMPLES } from '../examples';
import {
  definitionFromForm,
  emptyForm,
  emptyRule,
  formCoverage,
  formFromDefinition,
  RUNNER_IMAGE,
  ruleHostError,
  type AgentForm,
} from './agentForm';

const IG = 'https://inference-gateway.compute.dev.ddcdragon.com/anthropic';
const base = (): AgentForm => ({
  ...emptyForm({ baseUrl: IG, model: 'glm-5.3', credential: 'ddc-inference' }),
  name: 'triage',
});

const secret = (name: string, hosts?: string[]): SecretSummary => ({
  name,
  type: 'header',
  header: 'Authorization',
  ...(hosts ? { hosts } : {}),
  created_at: '2026-11-25T00:00:00Z',
  updated_at: '2026-11-25T00:00:00Z',
});

describe('definitionFromForm', () => {
  it('saves a new claude-code agent as cere.agent/v1, fields in the examples’ order', () => {
    const { def, errors } = definitionFromForm({
      ...base(),
      description: '  Reads issues  ',
      systemPrompt: 'You triage.',
      rules: [{ host: 'API.GitHub.com.', methods: ['GET'], path: '/repos/', credential: 'github-readonly' }],
    });
    expect(errors).toEqual({});
    expect(def).toEqual({
      schema: 'cere.agent/v1',
      name: 'triage',
      description: 'Reads issues',
      harness: 'claude-code',
      image: RUNNER_IMAGE,
      command: null,
      system_prompt: 'You triage.',
      model: { base_url: IG, model: 'glm-5.3', credential: 'ddc-inference' },
      tools: ['Read', 'Grep', 'Glob', 'WebFetch'],
      policy: 'read-only',
      deny: [],
      max_turns: 30,
      resources: { cpu: 0.5, memory: 512 },
      timeout_s: 900,
      egress: {
        allow: [{ host: 'api.github.com', methods: ['GET'], path_prefix: '/repos/', credential: 'github-readonly' }],
      },
      files: {},
    });
    expect(Object.keys(def!)).toEqual(Object.keys(JSON.parse(readExample('research.json'))));
    // What Save writes is what the import dialog accepts.
    expect(parseAgentDefinition(JSON.stringify(def)).errors).toEqual([]);
  });

  it('splits a container command like a shell and keeps the image', () => {
    const { def } = definitionFromForm({
      ...base(),
      harness: 'container',
      image: 'ghcr.io/me/agent:1',
      command: `python -c 'print("hi there")'`,
    });
    expect(def).toMatchObject({ harness: 'container', image: 'ghcr.io/me/agent:1' });
    expect(def!.command).toEqual(['python', '-c', 'print("hi there")']);
  });

  it('leaves out an empty description, system prompt and model credential, and a rule’s empty path and credential', () => {
    const { def } = definitionFromForm({
      ...base(),
      modelCredential: '',
      rules: [{ ...emptyRule(), host: 'pypi.org' }],
    });
    expect(def).not.toHaveProperty('description');
    expect(def).not.toHaveProperty('system_prompt');
    expect(def!.model).toEqual({ base_url: IG, model: 'glm-5.3' });
    expect(def!.egress!.allow).toEqual([{ host: 'pypi.org', methods: ['GET'] }]);
  });

  it('writes methods in a fixed order and deny rules one per line', () => {
    const { def } = definitionFromForm({
      ...base(),
      deny: 'rm -rf\n\n  curl .*\\|\\s*sh  ',
      rules: [{ host: 'x.example.com', methods: ['POST', 'GET'], path: '', credential: '' }],
    });
    expect(def!.egress!.allow[0].methods).toEqual(['GET', 'POST']);
    expect(def!.deny).toEqual(['rm -rf', 'curl .*\\|\\s*sh']);
  });

  it('names each field that stops the save', () => {
    const { def, errors } = definitionFromForm({
      ...base(),
      name: 'Bad Name',
      harness: 'container',
      command: '',
      image: ' ',
      baseUrl: 'inference-gateway',
      model: '',
      maxTurns: '0',
      cpu: '0',
      memoryMib: '64',
      timeoutS: '0',
      deny: '(',
      rules: [
        { host: 'https://api.github.com/', methods: ['GET'], path: '', credential: '' },
        { host: 'pypi.org', methods: [], path: '', credential: '' },
        { host: 'pypi.org', methods: ['GET'], path: 'pypi', credential: '' },
        { host: '*.com', methods: ['GET'], path: '', credential: '' },
        { host: 'ok.example', methods: ['GET'], path: '', credential: '' },
      ],
    });
    expect(def).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(
      [
        'baseUrl',
        'command',
        'cpu',
        'deny',
        'image',
        'maxTurns',
        'memoryMib',
        'model',
        'name',
        'rules',
        'timeoutS',
      ].sort(),
    );
    expect(errors.rules![0]).toMatch(/not a host name/);
    expect(errors.rules![1]).toMatch(/method/);
    expect(errors.rules![2]).toMatch(/starts with \//);
    expect(errors.rules![3]).toMatch(/two labels/);
    expect(errors.rules![4]).toBeUndefined();
  });

  it('takes a time limit of any length', () => {
    const { def, errors } = definitionFromForm({ ...base(), timeoutS: '172800' });
    expect(errors).toEqual({});
    expect(def?.timeout_s).toBe(172800);
  });

  it('keeps the files and fields the form doesn’t edit', () => {
    const def = {
      ...AGENT_EXAMPLES[0].def,
      files: { 'notes.md': '# notes' },
      future_field: { a: 1 },
    };
    const back = definitionFromForm(formFromDefinition(def)).def;
    expect(back).toEqual(def);
  });
});

const readExample = (file: string) => readFileSync(new URL(`../examples/${file}`, import.meta.url), 'utf8');

describe('formFromDefinition', () => {
  it.each(AGENT_EXAMPLES.map((e) => [e.file, e] as const))(
    'gives back %s field for field, in its order, as the import dialog would save it',
    (file, e) => {
      const { def, errors } = definitionFromForm(formFromDefinition(e.def));
      expect(errors).toEqual({});
      // saveAgent writes JSON.stringify(def, null, 2) + "\n": the release asset's document, keys in the same order
      // (the asset keeps short objects such as resources on one line, which is only whitespace).
      expect(`${JSON.stringify(def, null, 2)}\n`).toBe(`${JSON.stringify(JSON.parse(readExample(file)), null, 2)}\n`);
    },
  );

  it('shows a container command as one line the form splits back', () => {
    const lg = AGENT_EXAMPLES.find((e) => e.def.harness === 'container')!.def;
    expect(formFromDefinition(lg).command).toBe('/app/entrypoint.sh python /app/agent.py');
    expect(formFromDefinition({ ...lg, command: ['sh', '-c', 'echo "a b"'] }).command).toBe(`sh -c 'echo "a b"'`);
  });
});

describe('ruleHostError', () => {
  it.each(['api.github.com', '*.example.com', '10.0.0.1', 'localhost'])('accepts %s', (h) => {
    expect(ruleHostError(h)).toBeNull();
  });
  it.each(['', 'API.github.com', 'https://x.org', 'x.org/path', '*.org', 'a..b', '-a.org'])('refuses %s', (h) => {
    expect(ruleHostError(h)).not.toBeNull();
  });
});

describe('formCoverage', () => {
  it('checks the model credential against the model host and each rule’s against its host', () => {
    const form = {
      ...base(),
      rules: [
        { host: 'api.github.com', methods: ['GET' as const], path: '', credential: 'github-readonly' },
        { host: 'uploads.github.com', methods: ['GET' as const], path: '', credential: 'github-readonly' },
        { host: 'pypi.org', methods: ['GET' as const], path: '', credential: '' },
        { host: 'api.openai.com', methods: ['POST' as const], path: '', credential: 'openai' },
      ],
    };
    const cov = formCoverage(form, [
      secret('ddc-inference', ['inference-gateway.compute.dev.ddcdragon.com']),
      secret('github-readonly', ['api.github.com']),
    ]);
    expect(cov.model).toEqual({
      state: 'covered',
      name: 'ddc-inference',
      hosts: ['inference-gateway.compute.dev.ddcdragon.com'],
    });
    // One coverage per name a rule uses: none for a rule without a credential.
    expect(cov.rules.map((cs) => cs.map((c) => c.state))).toEqual([['covered'], ['not-covered'], [], ['missing']]);
    expect(cov.rules[1][0]).toEqual({
      state: 'not-covered',
      name: 'github-readonly',
      hosts: ['api.github.com'],
      host: 'uploads.github.com',
    });
  });

  it('says nothing about bindings until the secrets are read', () => {
    expect(formCoverage(base(), undefined).model).toEqual({ state: 'unknown' });
  });

  it('warns about a model key bound to another gateway', () => {
    const cov = formCoverage(base(), [secret('ddc-inference', ['inference-gateway.compute.test.ddcdragon.com'])]);
    expect(cov.model.state).toBe('not-covered');
  });
});

describe('requests and limits in the agent form', () => {
  it('starts at the runner’s request with no limits, and writes none', () => {
    const f = base();
    expect([f.cpu, f.memoryMib, f.cpuLimit, f.memoryLimitMib]).toEqual(['0.5', '512', '', '']);
    expect(definitionFromForm(f).def?.resources).toEqual({ cpu: 0.5, memory: 512 });
  });

  it('writes the limits when set, and reads them back', () => {
    const { def, errors } = definitionFromForm({
      ...base(),
      cpu: '0.5',
      memoryMib: '512',
      cpuLimit: '4',
      memoryLimitMib: '1024',
    });
    expect(errors).toEqual({});
    expect(def?.resources).toEqual({ cpu: 0.5, memory: 512, cpu_limit: 4, memory_limit: 1024 });
    const back = formFromDefinition(def!);
    expect([back.cpu, back.memoryMib, back.cpuLimit, back.memoryLimitMib]).toEqual(['0.5', '512', '4', '1024']);
    expect(parseAgentDefinition(JSON.stringify(def)).errors).toEqual([]);
  });

  it('refuses a limit below the request', () => {
    const { def, errors } = definitionFromForm({
      ...base(),
      cpu: '2',
      cpuLimit: '1',
      memoryMib: '2048',
      memoryLimitMib: '1024',
    });
    expect(def).toBeNull();
    expect(errors.cpuLimit).toBe('At least the request, 2 vCPU.');
    expect(errors.memoryLimitMib).toBe('At least the request, 2 GiB.');
  });

  it('keeps the disk and pids of a definition it edits', () => {
    const withDisk = { ...definitionFromForm(base()).def!, resources: { cpu: 1, memory: 1024, disk: 4096, pids: 128 } };
    const f = formFromDefinition(withDisk);
    expect(definitionFromForm({ ...f, memoryLimitMib: '2048' }).def?.resources).toEqual({
      cpu: 1,
      memory: 1024,
      memory_limit: 2048,
      disk: 4096,
      pids: 128,
    });
  });

  it('refuses a resources key the API does not take, naming the one it does', () => {
    const doc = {
      ...definitionFromForm(base()).draft,
      resources: { cpu: 1, memory_mib: 1024, disk_mib: 2048, ram: 1 },
    };
    expect(parseAgentDefinition(JSON.stringify(doc)).errors).toEqual([
      '"resources.memory_mib" is not a field: the name is "memory" (MiB).',
      '"resources.disk_mib" is not a field: the name is "disk" (MiB).',
      '"resources.ram" is not a field: use "cpu", "memory", "cpu_limit", "memory_limit", "disk", "pids".',
    ]);
    const badDisk = { ...definitionFromForm(base()).draft, resources: { disk: 0.5 } };
    expect(parseAgentDefinition(JSON.stringify(badDisk)).errors).toEqual([
      '"resources.disk" must be a whole number of MiB, 1 or more.',
    ]);
  });

  it('refuses a stored definition whose limit is below its request', () => {
    const doc = {
      ...definitionFromForm(base()).draft,
      resources: { cpu: 2, memory: 512, cpu_limit: 1, memory_limit: 256 },
    };
    expect(parseAgentDefinition(JSON.stringify(doc)).errors).toEqual([
      '"resources.cpu_limit" must be at least the CPU request.',
      '"resources.memory_limit" must be at least the memory request.',
    ]);
  });
});
