// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ComputeClient } from '../../../compute/client';
import { ComputeContext, type Compute } from '../../../compute/ComputeProvider';
import type { CreateSandboxRequest } from '../../../compute/types';
import { CredentialDialogProvider } from './credentials/CredentialDialogs';
import { NewSandboxDialog } from './NewSandboxDialog';

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
  tokenExpiresAt: Date.now() + 60_000,
  storeTokenAsSecret: null,
});

async function render() {
  const create = vi.fn(async (req: CreateSandboxRequest) => ({ id: 'sb-1', image: req.image }));
  const client = { listSecrets: async () => [], createSandbox: create } as unknown as ComputeClient;
  await act(async () =>
    root.render(
      <MemoryRouter>
        <ComputeContext.Provider value={compute(client)}>
          <CredentialDialogProvider>
            <NewSandboxDialog open onClose={vi.fn()} />
          </CredentialDialogProvider>
        </ComputeContext.Provider>
      </MemoryRouter>,
    ),
  );
  await flush();
  return create;
}

const input = (label: string): HTMLInputElement => {
  const l = [...document.querySelectorAll('label')].find((x) => x.textContent?.startsWith(label));
  const el = l && (document.getElementById(l.htmlFor) as HTMLInputElement | null);
  if (!el) throw new Error(`no input labelled ${label}`);
  return el;
};

/** Type into a React-controlled input the way a browser does. */
function type(el: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The select labelled `label`: its shown value, and its options once opened. */
const select = (label: string): HTMLElement => {
  const l = [...document.querySelectorAll('label')].find((x) => x.textContent === label)!;
  return l.parentElement!.querySelector('[role="combobox"]') as HTMLElement;
};
const button = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent === text)!;

describe('New sandbox', () => {
  it('stops after 5 minutes unless told otherwise, offers no timeout, and says nothing of the page’s token', async () => {
    const create = await render();
    expect(select('Stops after').textContent).toBe('5 minutes');
    expect(document.body.textContent).not.toMatch(/access token/i);

    act(() => {
      select('Stops after').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    const options = [...document.querySelectorAll('[role="option"]')];
    expect(options.map((o) => o.textContent)).toEqual(['5 minutes', '30 minutes', '1 hour', '24 hours', 'No timeout']);
    await act(async () => (options[4] as HTMLElement).click());
    expect(select('Stops after').textContent).toBe('No timeout');

    await act(async () => button('Create sandbox').click());
    await flush();
    expect(create).toHaveBeenCalledTimes(1);
    const req = create.mock.calls[0][0];
    expect(req.timeout_s).toBe(0);
    expect(req.resources).toBeUndefined();
  });

  it('sends the disk typed, in MiB, and refuses one that is not a whole number', async () => {
    const create = await render();
    const disk = input('Disk (MiB)');
    expect(disk.placeholder).toBe('512');
    expect(document.body.textContent).toContain('No space left on device');
    expect(document.body.textContent).toContain('the sandbox keeps running');

    act(() => type(disk, '0.5'));
    expect(document.body.textContent).toContain('A whole number of MiB, 1 or more.');
    await act(async () => button('Create sandbox').click());
    expect(create).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Fix the disk size first.');

    act(() => type(disk, '2048'));
    await act(async () => button('Create sandbox').click());
    await flush();
    const req = create.mock.calls[0][0];
    expect(req.resources).toEqual({ disk: 2048 });
    expect(req.timeout_s).toBe(300);
  });
});
