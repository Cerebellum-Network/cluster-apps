// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStoreContext } from '../hooks';
import type { AppStore } from '../stores';
import { usageTokenKey } from '../inference/usageToken';
import { agentRuns } from './agentRuns';
import type { AgentDefinition } from './agentDefinition';
import { ComputeError, type ComputeClient } from './client';
import { ComputeContext, type Compute } from './ComputeProvider';
import { usePolled } from './hooks';
import { EMPTY_USAGE, type Sandbox } from './types';
import { useComputeToken, type ComputeToken } from './useComputeToken';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  localStorage.clear();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const flush = () => act(async () => new Promise<void>((r) => setTimeout(r, 0)));

/** The account store as the token hook uses it: who is signed in, and the wallet-signed mint. */
function fakeAccount(mint: () => Promise<string>) {
  const account = { account: 'aa', isReady: () => true, createInferenceApiKey: vi.fn(mint) };
  const store = { accountStore: account } as unknown as AppStore;
  const wrap = (children: ReactNode) => <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
  return { account, wrap };
}

describe('useComputeToken', () => {
  const MSG = { mintFailed: 'mint failed', rejected: 'refused' };

  it('mints once for two pages of the same bucket and caches the token', async () => {
    const { account, wrap } = fakeAccount(async () => 'tok-1');
    const seen: ComputeToken[][] = [[], []];
    const Probe = ({ i }: { i: number }) => {
      seen[i].push(useComputeToken('7', MSG).state);
      return null;
    };
    await act(async () => root.render(wrap(<>{[<Probe key="a" i={0} />, <Probe key="b" i={1} />]}</>)));
    await flush();
    expect(account.createInferenceApiKey).toHaveBeenCalledTimes(1);
    const cached = JSON.parse(localStorage.getItem(usageTokenKey('aa', '7'))!);
    expect(cached.token).toBe('tok-1');
    // The state says when the token stops working: what a secret stored from it says too.
    expect(seen[0].at(-1)).toEqual({ kind: 'ready', key: 'tok-1', expiresAt: cached.expiresAt });
    expect(seen[1].at(-1)).toEqual({ kind: 'ready', key: 'tok-1', expiresAt: cached.expiresAt });
    expect(cached.expiresAt - Date.now()).toBeGreaterThan(23 * 3600 * 1000);

    // A later page reads the cached token, with the same expiry: no second wallet prompt.
    seen[0].length = 0;
    await act(async () => root.render(wrap(<Probe i={0} />)));
    await flush();
    expect(account.createInferenceApiKey).toHaveBeenCalledTimes(1);
    expect(seen[0].at(-1)).toEqual({ kind: 'ready', key: 'tok-1', expiresAt: cached.expiresAt });
  });

  it('does not loop wallet prompts when a fresh token is refused', async () => {
    const { account, wrap } = fakeAccount(async () => 'tok-2');
    let api: ReturnType<typeof useComputeToken> | null = null;
    const Probe = () => {
      api = useComputeToken('8', MSG);
      return null;
    };
    await act(async () => root.render(wrap(<Probe />)));
    await flush();
    await act(async () => api!.onAuthError());
    await flush();
    expect(account.createInferenceApiKey).toHaveBeenCalledTimes(1);
    expect(api!.state).toMatchObject({ kind: 'error', message: 'refused' });
    expect(localStorage.getItem(usageTokenKey('aa', '8'))).toBeNull();
    // Retry (the user's button) mints again.
    await act(async () => api!.retry());
    await flush();
    expect(account.createInferenceApiKey).toHaveBeenCalledTimes(2);
    expect(api!.state).toMatchObject({ kind: 'ready', key: 'tok-2' });
  });

  it('says why when the wallet does not sign', async () => {
    const { wrap } = fakeAccount(async () => {
      throw new Error('user rejected');
    });
    let state: ComputeToken | null = null;
    const Probe = () => {
      state = useComputeToken('9', MSG).state;
      return null;
    };
    await act(async () => root.render(wrap(<Probe />)));
    await flush();
    expect(state).toEqual({ kind: 'error', message: 'mint failed', detail: 'user rejected' });
  });
});

describe('usePolled', () => {
  const compute = (client: ComputeClient | null, onAuthError = vi.fn()): Compute => ({
    status: client ? 'ready' : 'minting',
    bucketId: '7',
    client,
    error: null,
    gatewayUrl: 'x',
    network: 'devnet',
    onAuthError,
    retry: vi.fn(),
    ensureBucket: vi.fn(),
    tokenExpiresAt: null,
    storeTokenAsSecret: null,
  });

  it('keeps the last answer through a failed poll and hands a 401 to the provider', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      const answers: Array<() => Promise<number>> = [
        async () => 1,
        async () => {
          throw new ComputeError(401, 'token expired');
        },
      ];
      const fn = vi.fn(() => (answers.shift() ?? (async () => 3))());
      const onAuthError = vi.fn();
      let polled: ReturnType<typeof usePolled<number>> | null = null;
      const Probe = () => {
        polled = usePolled(fn, 'k', 1000);
        return null;
      };
      const client = {} as ComputeClient;
      await act(async () =>
        root.render(
          <ComputeContext.Provider value={compute(client, onAuthError)}>
            <Probe />
          </ComputeContext.Provider>,
        ),
      );
      await flush();
      expect(polled!.data).toBe(1);
      await act(async () => vi.advanceTimersByTime(1000));
      await flush();
      expect(onAuthError).toHaveBeenCalledTimes(1);
      expect(polled!.data).toBe(1);
      expect(polled!.error).toBe('token expired');
      await act(async () => vi.advanceTimersByTime(1000));
      await flush();
      expect(polled!.data).toBe(3);
      expect(polled!.error).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits for the client before reading', async () => {
    const fn = vi.fn(async () => 1);
    const Probe = () => {
      usePolled(fn, 'k', null);
      return null;
    };
    await act(async () =>
      root.render(
        <ComputeContext.Provider value={compute(null)}>
          <Probe />
        </ComputeContext.Provider>,
      ),
    );
    await flush();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('agentRuns', () => {
  it('drives a run in the background and records its events and end', async () => {
    const sb: Sandbox = {
      id: 'sb-9',
      status: 'running',
      bucket: 7,
      node: 'n',
      runtime: 'gvisor',
      image: 'i',
      command: [],
      workdir: '/workspace',
      resources: { cpu: 1, memory_mib: 2048 },
      timeout_s: 1,
      idle_timeout_s: 0,
      env_keys: [],
      egress: { allow: [] },
      labels: {},
      created_at: '2026-11-25T00:00:00Z',
      started_at: null,
      ended_at: null,
      startup_ms: 10,
      exit_reason: null,
      exit_code: null,
      retained: [],
      usage: EMPTY_USAGE,
    };
    const client = {
      createSandbox: async () => sb,
      putFile: async () => undefined,
      execStream: async (_id: string, _r: unknown, on: (e: { type: 'stdout'; data: string }) => void) => {
        on({ type: 'stdout', data: '{"event":"text","text":"hi"}\n' });
        return { exit_code: 0, duration_ms: 1, timed_out: false };
      },
      getFile: async () => new Blob([JSON.stringify({ output: 'done' })]),
      terminate: async () => ({ ...sb, status: 'terminated' as const }),
    } as unknown as ComputeClient;
    const def = {
      schema: 'cere.agent/v1',
      name: 'a',
      harness: 'claude-code',
      image: 'i',
      model: { base_url: 'https://m.example/anthropic', model: 'm', credential: 'c' },
    } as AgentDefinition;
    const runId = agentRuns.start({ client, def, input: 'q', bucket: null });
    expect(agentRuns.get(runId)?.step).toBe('create');
    await vi.waitFor(() => expect(agentRuns.get(runId)?.endedAt).not.toBeNull());
    const run = agentRuns.get(runId)!;
    expect(run.result?.output?.output).toBe('done');
    expect(run.events).toContainEqual({ event: 'text', text: 'hi' });
    expect(run.sandbox?.status).toBe('terminated');
    expect(agentRuns.bySandbox('sb-9')?.runId).toBe(runId);
  });
});
