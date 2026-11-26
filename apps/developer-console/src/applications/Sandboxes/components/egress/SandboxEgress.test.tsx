// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComputeError, type ComputeClient } from '../../../../compute/client';
import { ComputeContext, type Compute } from '../../../../compute/ComputeProvider';
import { EMPTY_USAGE, type EgressEntry, type Sandbox } from '../../../../compute/types';
import { CredentialDialogProvider } from '../credentials/CredentialDialogs';
import SandboxEgress from './SandboxEgress';

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
  document.body.innerHTML = '';
});

const flush = () => act(async () => new Promise<void>((r) => setTimeout(r, 0)));

const sandbox = (over: Partial<Sandbox> = {}): Sandbox => ({
  id: 'sb-1',
  status: 'running',
  bucket: 4116,
  node: 'n',
  runtime: 'gvisor',
  image: { ref: 'python:3.12-slim', digest: null, size_bytes: null, cached: null, pull_ms: null },
  command: [],
  workdir: '/workspace',
  resources: { cpu: 1, memory: 1024 },
  timeout_s: 600,
  idle_timeout_s: 0,
  env_keys: [],
  egress: { allow: [{ host: 'pypi.org', methods: ['GET'] }] },
  labels: {},
  created_at: '2026-11-25T10:00:00Z',
  started_at: null,
  ready_at: null,
  ended_at: null,
  startup_ms: null,
  exit_reason: null,
  exit_kind: null,
  exit_code: null,
  retained: [],
  retain: null,
  not_retained: [],
  retained_until: null,
  registry_credential: null,
  idempotency_key: null,
  usage: EMPTY_USAGE,
  ...over,
});

const denied: EgressEntry = {
  id: 7,
  ts: '2026-11-25T10:01:00Z',
  bucket: 4116,
  sandbox_id: 'sb-1',
  node: 'n',
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
};

function fakeClient(setEgress: ComputeClient['setEgress']): ComputeClient {
  return {
    listSecrets: async () => [],
    egressLog: async () => ({ items: [denied], next_cursor: null }),
    listSandboxes: async () => ({ items: [], next_cursor: null }),
    setEgress,
  } as unknown as ComputeClient;
}

const compute = (client: ComputeClient): Compute => ({
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
});

const buttons = (label: RegExp) =>
  [...document.querySelectorAll('button')].filter((b) => label.test(b.textContent ?? ''));

async function render(client: ComputeClient, sb: Sandbox, onUpdated = vi.fn()) {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <ComputeContext.Provider value={compute(client)}>
          <CredentialDialogProvider>
            <SandboxEgress sb={sb} onUpdated={onUpdated} />
          </CredentialDialogProvider>
        </ComputeContext.Provider>
      </MemoryRouter>,
    ),
  );
  await flush();
  return onUpdated;
}

describe('SandboxEgress', () => {
  it('allows a refused host for the running sandbox: PUT with the new rule first, then says the next request goes through', async () => {
    const after = sandbox({
      egress: {
        allow: [
          { host: 'example.com', methods: ['GET'] },
          { host: 'pypi.org', methods: ['GET'] },
        ],
      },
    });
    const setEgress = vi.fn(async () => after);
    const onUpdated = await render(fakeClient(setEgress), sandbox());

    expect(document.body.textContent).toContain('Refused by the egress proxy: 1 host');
    const allow = buttons(/^Allow example\.com$/);
    expect(allow).toHaveLength(1);
    await act(async () => allow[0].click());
    await flush();
    expect(document.body.textContent).toContain('Allow example.com for this sandbox');

    await act(async () => buttons(/^Allow$/)[0].click());
    await flush();
    expect(setEgress).toHaveBeenCalledWith('sb-1', {
      allow: [
        { host: 'example.com', methods: ['GET'] },
        { host: 'pypi.org', methods: ['GET'] },
      ],
    });
    expect(onUpdated).toHaveBeenCalledWith(after);
    expect(document.body.textContent).toContain('Allowed GET example.com. The next request goes through.');
  });

  it('says so when the gateway has no such route yet', async () => {
    const setEgress = vi.fn(async () => {
      throw new ComputeError(405, 'Method Not Allowed');
    });
    await render(fakeClient(setEgress), sandbox());
    await act(async () => buttons(/^Allow example\.com$/)[0].click());
    await flush();
    await act(async () => buttons(/^Allow$/)[0].click());
    await flush();
    expect(document.body.textContent).toContain('can’t change a running sandbox’s rules yet');
  });

  it('offers nothing to allow on a sandbox that has ended', async () => {
    await render(fakeClient(vi.fn()), sandbox({ status: 'terminated', ended_at: '2026-11-25T10:05:00Z' }));
    expect(buttons(/^Allow/)).toHaveLength(0);
    expect(document.body.textContent).toContain('The sandbox has ended; these were its last rules.');
  });
});
