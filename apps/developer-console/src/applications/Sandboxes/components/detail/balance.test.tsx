// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComputeError, type ComputeClient } from '../../../../compute/client';
import { ComputeContext, type Compute } from '../../../../compute/ComputeProvider';
import { EMPTY_USAGE, type Sandbox } from '../../../../compute/types';
import ExecPanel from './ExecPanel';
import FilesPanel from './FilesPanel';

// A bucket whose owner has no balance: the calls that cost money (exec, file upload) are refused with 403
// insufficient_balance; the panels say so in words, with the way to top up.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const flush = () => act(async () => new Promise<void>((r) => setTimeout(r, 0)));
const refused = () => new ComputeError(403, 'bucket owner has insufficient balance', 'insufficient_balance');

const client = {
  exec: async () => {
    throw refused();
  },
  execStream: async () => {
    throw refused();
  },
} as unknown as ComputeClient;

const compute: Compute = {
  status: 'ready',
  bucketId: '4116',
  client,
  error: null,
  gatewayUrl: 'x',
  network: 'devnet',
  onAuthError: vi.fn(),
  retry: vi.fn(),
  ensureBucket: vi.fn(),
  tokenExpiresAt: null,
  storeTokenAsSecret: null,
};

const sb: Sandbox = {
  id: 'sb-1',
  status: 'running',
  bucket: 4116,
  node: 'n',
  runtime: 'gvisor',
  image: 'python:3.12-slim',
  command: [],
  workdir: '/workspace',
  resources: { cpu: 0.25, memory: 128, cpu_limit: 1, memory_limit: 1024, disk: 512 },
  timeout_s: 300,
  idle_timeout_s: 0,
  env_keys: [],
  egress: { allow: [] },
  labels: {},
  created_at: '2026-11-26T10:00:00Z',
  started_at: '2026-11-26T10:00:01Z',
  ended_at: null,
  startup_ms: 200,
  exit_reason: null,
  exit_code: null,
  retained: [],
  usage: EMPTY_USAGE,
};

const render = (node: ReactNode) =>
  act(async () =>
    root.render(
      <MemoryRouter>
        <ComputeContext.Provider value={compute}>{node}</ComputeContext.Provider>
      </MemoryRouter>,
    ),
  );

const topUpLink = () => [...host.querySelectorAll('a')].find((a) => a.textContent === 'Top up in Billing');

describe('out of balance', () => {
  it('says a refused command in words, with the way to top up', async () => {
    await render(<ExecPanel id={sb.id} status="running" workdir="/workspace" egress={sb.egress} />);
    expect(topUpLink()).toBeUndefined();
    const runCode = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Run code')!;
    await act(async () => runCode.click());
    await flush();
    expect(host.textContent).toContain('Not run: the bucket is out of balance.');
    expect(host.textContent).toContain('Running a command needs a balance');
    expect(host.textContent).not.toContain('insufficient balance');
    expect(topUpLink()?.getAttribute('href')).toBe('/billing');
  });

  it('says why its files can’t be listed, with the way to top up', async () => {
    await render(<FilesPanel sb={sb} />);
    await flush();
    expect(host.textContent).toContain('The bucket is out of balance.');
    expect(host.textContent).toContain('Listing its files runs a command, which needs a balance.');
    expect(topUpLink()?.getAttribute('href')).toBe('/billing');
  });
});
