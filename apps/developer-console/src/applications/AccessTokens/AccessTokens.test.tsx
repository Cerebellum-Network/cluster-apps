// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import AccessTokens from './AccessTokens';

vi.mock('../../hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../hooks')>()),
  useAccount: () => ({ buckets: [{ name: 'agents-4116' }], bucketsError: null }),
}));
vi.mock('../../inference/useInference', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../inference/useInference')>()),
  useOwnerBuckets: () => ({ buckets: [{ id: 4116 }], loading: false, error: null, ensureBucket: async () => '4116' }),
}));
vi.mock('../../compute/walletSigning', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../compute/walletSigning')>()),
  useCanSign: () => true,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Access tokens', () => {
  it('offers the S3 credential for agent definitions to everyone, labelled Experimental', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => root.render(<AccessTokens />));
    expect(host.querySelector('h1')?.parentElement?.textContent).toContain(
      'and for agent definitions in your storage buckets.',
    );
    const section = [...host.querySelectorAll('h2')].find((h) => h.textContent === 'Agent definitions in your bucket');
    expect(section).toBeDefined();
    expect(section!.parentElement!.textContent).toBe('Agent definitions in your bucketExperimental');
    expect(host.textContent).toContain('Create S3 credential');
    act(() => root.unmount());
  });
});
