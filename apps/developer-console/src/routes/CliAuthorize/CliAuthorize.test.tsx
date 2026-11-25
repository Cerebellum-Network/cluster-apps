// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStoreContext } from '../../hooks';
import type { AppStore } from '../../stores';
import CliAuthorize from './CliAuthorize';

vi.mock('../../inference/useInference', () => ({
  useOwnerBuckets: () => ({ buckets: [{ id: 4116n }], loading: false, error: null, ensureBucket: vi.fn() }),
}));
vi.mock('../../compute/walletSigning', () => ({ useCanSign: () => true, NO_WALLET_HERE: 'no wallet here' }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KEY = 'b2'.repeat(32);
const STATE = 'c3RhdGUtc3RhdGUtc3RhdGU';

let root: Root;
let host: HTMLElement;
let posted: { action: string; fields: Record<string, string> }[];
const realSubmit = HTMLFormElement.prototype.submit;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  posted = [];
  HTMLFormElement.prototype.submit = function (this: HTMLFormElement) {
    posted.push({ action: this.action, fields: Object.fromEntries(new FormData(this)) as Record<string, string> });
  };
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = '';
  HTMLFormElement.prototype.submit = realSubmit;
});

const flush = () => act(async () => new Promise<void>((r) => setTimeout(r, 0)));
const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent === label)!;

async function open(query: string, grant = vi.fn(async () => 'GRANT58')) {
  const store = { accountStore: { account: 'aa', isReady: () => true, createCliGrant: grant } } as unknown as AppStore;
  await act(async () =>
    root.render(
      <AppStoreContext.Provider value={store}>
        <MemoryRouter initialEntries={[`/cli/authorize?${query}`]}>
          <CliAuthorize />
        </MemoryRouter>
      </AppStoreContext.Provider>,
    ),
  );
  await flush();
  return grant;
}

describe('/cli/authorize', () => {
  it('shows what the CLI asks for, and on Approve signs a grant to its key and POSTs it to the loopback port', async () => {
    const grant = await open(`key=${KEY}&state=${STATE}&port=53682&code=AB12-CD34&host=laptop&days=30`);
    const page = document.body.textContent ?? '';
    expect(page).toContain('AB12-CD34');
    expect(page).toContain('laptop');
    expect(page).toContain('b2b2b2b2…b2b2b2b2');
    expect(page).toContain('Bucket 4116');
    expect(grant).not.toHaveBeenCalled();
    expect(posted).toHaveLength(0);

    await act(async () => button('Approve').click());
    await flush();
    expect(grant).toHaveBeenCalledWith(4116n, KEY, 30 * 86_400_000);
    expect(posted).toEqual([{ action: 'http://127.0.0.1:53682/callback', fields: { state: STATE, grant: 'GRANT58' } }]);
  });

  it('tells the CLI when it is denied, and signs nothing', async () => {
    const grant = await open(`key=${KEY}&state=${STATE}&port=53682`);
    await act(async () => button('Deny').click());
    await flush();
    expect(grant).not.toHaveBeenCalled();
    expect(posted).toEqual([
      { action: 'http://127.0.0.1:53682/callback', fields: { state: STATE, error: 'access_denied' } },
    ]);
    expect(document.body.textContent).toContain('Denied. Nothing was signed, and the CLI was told.');
  });

  it('shows the grant for pasting when the CLI has no browser (no port)', async () => {
    await open(`key=${KEY}&state=${STATE}`);
    await act(async () => button('Approve').click());
    await flush();
    expect(posted).toHaveLength(0);
    expect(document.body.textContent).toContain('GRANT58');
    expect(document.body.textContent).toContain('works only together with that CLI’s private key');
  });

  it('refuses a link that is not a request from the CLI', async () => {
    await open(`state=${STATE}&port=53682`);
    expect(document.body.textContent).toContain('isn’t a sign-in request from the cere CLI');
    expect(document.querySelectorAll('button')).toHaveLength(0);
  });
});
