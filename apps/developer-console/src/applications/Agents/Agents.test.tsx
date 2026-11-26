// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ComputeClient } from '../../compute/client';
import type { Compute, ComputeStatus } from '../../compute/ComputeProvider';
import type { Polled } from '../../compute/hooks';
import { EMPTY_USAGE, type Sandbox } from '../../compute/types';
import { AGENT_EXAMPLES } from './examples';
import Agents from './Agents';

// Every Agents page, with the reads it makes answered from fixtures: a bucket
// holding the research example, and one finished run of it.
const research = AGENT_EXAMPLES[0].def;

const run: Sandbox = {
  id: 'sb-run1',
  status: 'terminated',
  bucket: 4116,
  node: 'ab'.repeat(32),
  runtime: 'gvisor',
  image: research.image,
  command: ['sleep', 'infinity'],
  workdir: '/workspace',
  resources: { cpu: 0.5, memory_mib: 512 },
  timeout_s: 600,
  idle_timeout_s: 0,
  env_keys: [],
  egress: { allow: [] },
  labels: { 'cere.kind': 'agent-run', 'cere.agent': 'research', 'cere.harness': 'claude-code', 'cere.run': 'run-1' },
  created_at: '2026-11-25T10:00:00Z',
  started_at: '2026-11-25T10:00:01Z',
  ended_at: '2026-11-25T10:01:00Z',
  startup_ms: 200,
  exit_reason: 'terminated by API: agent run finished',
  exit_code: 0,
  retained: [],
  usage: EMPTY_USAGE,
};

const polled = <T,>(data: T): Polled<T> => ({ data, error: null, loading: false, at: 0, reload: () => {} });
/** A client whose calls never answer: the pages render what they hold before any answer. */
const client = new Proxy({}, { get: (_, k) => (k === 'then' ? undefined : () => new Promise(() => {})) });

let status: ComputeStatus = 'ready';
const compute = (): Compute => ({
  status,
  bucketId: '4116',
  client: status === 'ready' ? (client as ComputeClient) : null,
  error: null,
  gatewayUrl: 'https://agent-gateway.example.test',
  network: 'devnet',
  onAuthError: () => {},
  retry: () => {},
  ensureBucket: async () => '4116',
  tokenExpiresAt: status === 'ready' ? Date.UTC(2026, 10, 27) : null,
  storeTokenAsSecret: status === 'ready' ? async () => {} : null,
});

vi.mock('../../compute/ComputeProvider', async (importOriginal) => {
  const m = await importOriginal<typeof import('../../compute/ComputeProvider')>();
  return {
    ...m,
    ComputeProvider: ({ children }: { children: ReactNode }) => (
      <m.ComputeContext.Provider value={compute()}>{children}</m.ComputeContext.Provider>
    ),
  };
});
vi.mock('../../compute/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../compute/hooks')>()),
  useSandboxes: () => polled({ items: [run], next_cursor: null }),
  useSecrets: () => polled([]),
  useEgressLog: () => polled({ items: [], next_cursor: null }),
  useNow: () => Date.UTC(2026, 10, 25, 10, 2),
}));
vi.mock('../../compute/agentHooks', () => ({
  useAgentDefinitions: () => ({
    agents: [{ bucket: 'agents-4116', key: 'cere/agents/research.json', name: 'research', def: research, errors: [] }],
    failed: [],
    loading: false,
    error: null,
    reload: () => {},
  }),
}));
vi.mock('../../compute/agentStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../compute/agentStore')>()),
  readRunFile: () => new Promise(() => {}),
}));
vi.mock('../../compute/walletSigning', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../compute/walletSigning')>()),
  useCanSign: () => true,
  DevViewBanner: () => null,
}));
vi.mock('../../hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../hooks')>()),
  useAccount: () => ({ buckets: [{ name: 'agents-4116' }], bucketsError: null, storage: {} }),
}));
vi.mock('../../inference/useInference', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../inference/useInference')>()),
  useModels: () => ({ cards: [], loading: false, error: null, reload: () => {} }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  status = 'ready';
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const open = async (url: string) => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/agents/*" element={<Agents />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  const h1 = host.querySelectorAll('h1');
  expect(h1).toHaveLength(1);
  return h1[0];
};

/** "Experimental" beside the title: in the title's own row, not somewhere else on the page. */
const besideTitle = (h1: HTMLElement) => {
  const row = h1.parentElement!;
  const label = [...row.children].find((el) => el !== h1 && el.textContent === 'Experimental');
  expect(label, `no Experimental label beside "${h1.textContent}"`).toBeDefined();
  expect(label!.getAttribute('title')).toBe('Experimental: this may still change.');
};

describe('every Agents page says Experimental beside its title', () => {
  it.each([
    ['/agents', 'Agents'],
    ['/agents/list', 'Agents'],
    ['/agents/list/new', 'Create agent'],
    ['/agents/list/agents-4116/research', 'research'],
    ['/agents/list/agents-4116/research/edit', 'Edit research'],
    ['/agents/list/agents-4116/gone', 'gone'],
    ['/agents/runs', 'Runs'],
    ['/agents/runs/run-1', 'run-1'],
    ['/agents/runs/run-unknown', 'run-unknown'],
    // Old links redirect to the pages above.
    ['/agents/definitions/new', 'Create agent'],
    ['/agents/a/agents-4116/research', 'research'],
  ])('%s', async (url, title) => {
    const h1 = await open(url);
    expect(h1.textContent).toBe(title);
    besideTitle(h1);
  });

  it('the edit page shows the form, not only its title', async () => {
    await open('/agents/list/agents-4116/research/edit');
    expect(host.textContent).toContain('Harness');
    expect(host.textContent).toContain('Network access');
  });

  it('and so does the page asking for access to sandboxes', async () => {
    status = 'minting';
    const h1 = await open('/agents/runs');
    expect(h1.textContent).toBe('Agents');
    besideTitle(h1);
    expect(host.textContent).toContain('Approve access in your SSCP wallet');
  });
});
