// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ComputeClient } from '../../../../compute/client';
import { ComputeContext, type Compute } from '../../../../compute/ComputeProvider';
import { fmtDateTime } from '../../../../compute/format';
import { EMPTY_USAGE, type Sandbox } from '../../../../compute/types';
import FilesPanel from './FilesPanel';

// After a sandbox ends, its Files tab lists what it kept, each with its size, until retained_until, and the paths it
// did not keep, each with why.

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
  vi.useRealTimers();
});

const flush = () => act(async () => new Promise<void>((r) => setTimeout(r, 0)));

const getFile = vi.fn(async () => new Blob(['{"ok":true}']));
const compute: Compute = {
  status: 'ready',
  bucketId: '4116',
  client: { getFile } as unknown as ComputeClient,
  error: null,
  gatewayUrl: 'x',
  network: 'devnet',
  onAuthError: vi.fn(),
  retry: vi.fn(),
  ensureBucket: vi.fn(),
  tokenExpiresAt: null,
  storeTokenAsSecret: null,
};

const UNTIL = '2026-11-27T10:05:00Z';

const ended = (over: Partial<Sandbox> = {}): Sandbox => ({
  id: 'sb-1',
  status: 'terminated',
  bucket: 4116,
  node: 'n',
  runtime: 'gvisor',
  image: { ref: 'python:3.12-slim', digest: null, size_bytes: null, cached: null, pull_ms: null },
  command: ['sleep', 'infinity'],
  workdir: '/workspace',
  resources: { cpu: 0.25, memory: 128 },
  timeout_s: 300,
  idle_timeout_s: 0,
  env_keys: [],
  egress: { allow: [] },
  labels: {},
  created_at: '2026-11-26T10:00:00Z',
  started_at: '2026-11-26T10:00:02Z',
  ready_at: '2026-11-26T10:00:02Z',
  ended_at: '2026-11-26T10:05:00Z',
  startup_ms: 2000,
  exit_reason: 'timeout (300s)',
  exit_kind: 'timeout',
  exit_code: 137,
  retain: {
    paths: ['/workspace/output.json', '/workspace/out/', '/workspace/transcript.jsonl'],
    on: 'any',
    ttl_s: 86400,
  },
  retained: [
    { path: '/workspace/output.json', size: 812 },
    { path: '/workspace/out/a.txt', size: 2 },
  ],
  not_retained: [{ path: '/workspace/transcript.jsonl', reason: 'it does not exist in the sandbox' }],
  retained_until: UNTIL,
  registry_credential: null,
  idempotency_key: null,
  usage: EMPTY_USAGE,
  ...over,
});

const render = (sb: Sandbox) =>
  act(async () =>
    root.render(
      <MemoryRouter>
        <ComputeContext.Provider value={compute}>
          <FilesPanel sb={sb} />
        </ComputeContext.Provider>
      </MemoryRouter>,
    ),
  );

const row = (path: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.startsWith(path))!;

describe('kept files', () => {
  it('lists each kept file with its size, until when it is kept, and what was not kept and why', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-26T10:06:00Z'), toFake: ['Date'] });
    await render(ended());
    expect(host.textContent).toContain('Kept after it ended · 2 files, 814 B');
    expect(host.textContent).toContain(`Kept until ${fmtDateTime(UNTIL)}`);
    expect(row('/workspace/output.json').textContent).toContain('812 B');
    expect(host.textContent).toContain('Not kept · 1 path');
    expect(host.textContent).toContain('/workspace/transcript.jsonl');
    expect(host.textContent).toContain('it does not exist in the sandbox');

    await act(async () => row('/workspace/output.json').click());
    await flush();
    expect(getFile).toHaveBeenCalledWith('sb-1', '/workspace/output.json');
    expect([...host.querySelectorAll('button')].some((b) => b.textContent === 'Download')).toBe(true);
  });

  it('says they are gone once retained_until has passed, and reads none of them', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-28T00:00:00Z'), toFake: ['Date'] });
    getFile.mockClear();
    await render(ended());
    expect(host.textContent).toContain(`Gone since ${fmtDateTime(UNTIL)}`);
    await act(async () => row('/workspace/output.json').click());
    await flush();
    expect(getFile).not.toHaveBeenCalled();
    expect(host.textContent).toContain(`Gone: it was kept until ${fmtDateTime(UNTIL)}.`);
    expect([...host.querySelectorAll('button')].some((b) => b.textContent === 'Download')).toBe(false);
  });

  it('says how to keep files when it kept none', async () => {
    await render(ended({ retain: null, retained: [], not_retained: [], retained_until: null }));
    expect(host.textContent).toContain('This sandbox has ended and kept no files.');
    expect(host.textContent).toContain('name them in Keep files when you create a sandbox');
  });
});
