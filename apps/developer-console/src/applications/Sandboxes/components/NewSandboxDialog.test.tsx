// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComputeError, type ComputeClient } from '../../../compute/client';
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

async function render(refuse = false) {
  const create = vi.fn(async (req: CreateSandboxRequest) => {
    if (refuse) throw new ComputeError(403, 'bucket owner has insufficient balance', 'insufficient_balance');
    return { id: 'sb-1', image: req.image };
  });
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

  it('sends the files to keep as retain.paths, and refuses a path the API would', async () => {
    const create = await render();
    const keep = input('Keep files') as unknown as HTMLTextAreaElement;
    const typeArea = (value: string) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(keep, value);
      keep.dispatchEvent(new Event('input', { bubbles: true }));
    };

    act(() => typeArea('/workspace/../etc/passwd'));
    expect(document.body.textContent).toContain('/workspace/../etc/passwd has a . or .. part');
    await act(async () => button('Create sandbox').click());
    expect(create).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Fix the files to keep first.');

    act(() => typeArea('/workspace/output.json\n/workspace/out/\n/workspace/output.json'));
    await act(async () => button('Create sandbox').click());
    await flush();
    expect(create.mock.calls[0][0].retain).toEqual({ paths: ['/workspace/output.json', '/workspace/out/'] });
  });

  it('asks to keep nothing when no files are named', async () => {
    const create = await render();
    await act(async () => button('Create sandbox').click());
    await flush();
    expect(create.mock.calls[0][0]).not.toHaveProperty('retain');
  });

  it('says a create refused for balance in words, with the way to top up', async () => {
    await render(true);
    await act(async () => button('Create sandbox').click());
    await flush();
    expect(document.body.textContent).toContain('The bucket is out of balance.');
    expect(document.body.textContent).toContain('Creating a sandbox needs a balance');
    expect(document.body.textContent).not.toContain('insufficient balance');
    const topUp = [...document.querySelectorAll('a')].find((a) => a.textContent === 'Top up in Billing');
    expect(topUp?.getAttribute('href')).toBe('/billing');
  });
});
