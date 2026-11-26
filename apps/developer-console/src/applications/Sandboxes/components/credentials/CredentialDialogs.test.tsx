// @vitest-environment happy-dom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ComputeClient } from '../../../../compute/client';
import { ComputeContext, type Compute } from '../../../../compute/ComputeProvider';
import { NoBalance, ReadError } from '../ui';
import { CredentialDialogProvider, useCredentialDialogs } from './CredentialDialogs';

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

/** Type into a React-controlled input the way a browser does. */
function type(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const compute = (client: ComputeClient): Compute =>
  ({ status: 'ready', bucketId: '4116', client, onAuthError: vi.fn() }) as unknown as Compute;

describe('CredentialDialogProvider', () => {
  it('stores a credential bound to the rule’s host, write-only, and hands its name back', async () => {
    const putSecret = vi.fn(async () => undefined);
    const client = { putSecret, listSecrets: async () => [] } as unknown as ComputeClient;
    let stored: Promise<string | null> | null = null;
    const Probe = () => {
      const d = useCredentialDialogs();
      useEffect(() => {
        stored = d.store({ suggested: 'github-readonly', hosts: ['api.github.com'] });
      }, [d]);
      return null;
    };
    await act(async () =>
      root.render(
        <MemoryRouter>
          <ComputeContext.Provider value={compute(client)}>
            <CredentialDialogProvider>
              <Probe />
            </CredentialDialogProvider>
          </ComputeContext.Provider>
        </MemoryRouter>,
      ),
    );
    await flush();
    const inputs = [...document.querySelectorAll('input')] as HTMLInputElement[];
    const byLabel = (l: string) => inputs.find((i) => i.closest('.MuiFormControl-root')?.textContent?.startsWith(l))!;
    expect(byLabel('Name').value).toBe('github-readonly');
    expect(byLabel('Sent only to').value).toBe('api.github.com');
    const value = inputs.find((i) => i.type === 'password')!;
    await act(async () => type(value, 'ghp_example'));
    const save = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Save credential')!;
    await act(async () => save.click());
    await flush();
    expect(putSecret).toHaveBeenCalledWith('github-readonly', {
      type: 'header',
      header: 'Authorization',
      value: 'Bearer ghp_example',
      hosts: ['api.github.com'],
    });
    await expect(stored).resolves.toBe('github-readonly');
    // The form is gone, and the value with it.
    expect(document.querySelector('input[type=password]')).toBeNull();
  });
});

describe('NoBalance', () => {
  it('says the bucket is out of balance in words, with Billing one click away', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NoBalance title="The bucket is out of balance.">Creating a sandbox needs a balance.</NoBalance>
      </MemoryRouter>,
    );
    expect(html).toContain('The bucket is out of balance.');
    expect(html).toContain('Creating a sandbox needs a balance.');
    expect(html).toContain('href="/billing"');
    expect(html).toContain('Top up in Billing');
    expect(html).not.toContain('insufficient');
  });
});

describe('ReadError', () => {
  it('says a failure as it is', () => {
    const html = renderToStaticMarkup(<ReadError what="your sandboxes" error="502 bad gateway" />);
    expect(html).toContain('Couldn’t read your sandboxes: 502 bad gateway');
    expect(html).not.toContain('Billing');
  });
});
