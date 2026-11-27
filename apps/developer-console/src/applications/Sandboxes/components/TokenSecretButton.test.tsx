// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComputeError } from '../../../compute/client';
import { ComputeContext, type Compute } from '../../../compute/ComputeProvider';
import { fmtDateTime } from '../../../compute/format';
import TokenSecretButton from './TokenSecretButton';

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
const EXPIRES = Date.UTC(2026, 10, 26, 1, 16);

const compute = (store: Compute['storeTokenAsSecret'], expiresAt: number | null = EXPIRES): Compute =>
  ({
    status: store ? 'ready' : 'minting',
    bucketId: '4116',
    tokenExpiresAt: expiresAt,
    storeTokenAsSecret: store,
  }) as unknown as Compute;

const render = async (c: Compute, props: Parameters<typeof TokenSecretButton>[0] = {}) => {
  await act(async () =>
    root.render(
      <ComputeContext.Provider value={c}>
        <TokenSecretButton {...props} />
      </ComputeContext.Provider>,
    ),
  );
  return host.querySelector('button')!;
};

describe('TokenSecretButton', () => {
  it('stores the console’s token as ddc-inference, then says when it stops working', async () => {
    const store = vi.fn(async () => {});
    const onStored = vi.fn();
    const button = await render(compute(store), { onStored });
    expect(button.textContent).toBe('Store this console’s token as ddc-inference');
    expect(host.textContent).toContain(`good until ${fmtDateTime(EXPIRES)}`);

    await act(async () => button.click());
    await flush();
    expect(store).toHaveBeenCalledWith('ddc-inference');
    expect(onStored).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Stored ddc-inference: this console’s access token for compute bucket 4116.');
    expect(host.textContent).toContain(`It stops working when that token expires, ${fmtDateTime(EXPIRES)}`);
  });

  it('says it replaces a secret the bucket already holds', async () => {
    const held = {
      name: 'ddc-inference',
      type: 'header' as const,
      header: 'Authorization',
      created_at: '',
      updated_at: '',
    };
    const button = await render(compute(vi.fn(async () => {})), { held });
    expect(button.textContent).toBe('Replace ddc-inference with this console’s token');
  });

  it('shows the gateway’s refusal and claims nothing was stored', async () => {
    const store = vi.fn(async () => {
      throw new ComputeError(403, 'compute is not allowed on this bucket');
    });
    const onStored = vi.fn();
    const button = await render(compute(store), { onStored });
    await act(async () => button.click());
    await flush();
    expect(host.textContent).toContain('Couldn’t store ddc-inference: compute is not allowed on this bucket');
    expect(host.textContent).not.toContain('Stored ddc-inference');
    expect(onStored).not.toHaveBeenCalled();
  });

  it('is off until the console has its token', async () => {
    const button = await render(compute(null, null));
    expect(button.disabled).toBe(true);
    expect(host.textContent).toContain('Waiting for this console’s access to your sandboxes.');
  });
});
