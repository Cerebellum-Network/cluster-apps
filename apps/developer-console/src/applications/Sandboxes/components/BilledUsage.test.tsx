// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EMPTY_USAGE, type Sandbox, type Usage } from '../../../compute/types';
import BilledUsage, { billedHeader, billedText } from './BilledUsage';
import { ExitReason } from './ui';

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

const sandbox = (u: Partial<Usage>): Pick<Sandbox, 'usage' | 'resources'> => ({
  usage: { ...EMPTY_USAGE, ...u },
  resources: { cpu: 1, memory: 1024 },
});
const billed = sandbox({
  wall_s: 54,
  cpu_s: 9.4,
  ram_gib_s: 15,
  billing_basis: 'request_or_usage',
  reserved_cpu_s: 54,
  reserved_ram_gib_s: 54,
  billed_cpu_s: 54,
  billed_ram_gib_s: 54,
});
const unreported = sandbox({ wall_s: 54, cpu_s: 9.4, ram_gib_s: 15 });

describe('BilledUsage', () => {
  it('shows what is billed with what was measured, and the CLI’s line in its tooltip', () => {
    act(() => root.render(<BilledUsage sandbox={billed} />));
    expect(host.textContent).toBe('54.0 CPU-s (measured 9.4)54.0 GiB-s (measured 15.0)');
    expect(host.querySelector('[title]')?.getAttribute('title')).toBe(
      'billed 1.0 vCPU × 54.0 s = 54.0 CPU-s request, no burst (measured 9.4), ' +
        '1.0 GiB × 54.0 s = 54.0 GiB-s request, no burst (measured 15.0)',
    );
  });

  it('shows what was measured until the node reports billing', () => {
    act(() => root.render(<BilledUsage sandbox={unreported} />));
    expect(host.textContent).toBe('9.40 CPU-s15.0 GiB-s');
    expect(host.querySelector('[title]')).toBeNull();
    expect(billedText(unreported)).toBe('9.40 CPU-s · 15.0 GiB-s');
    expect(billedText(billed)).toMatch(
      /^billed 1\.0 vCPU × 54\.0 s = 54\.0 CPU-s request, no burst \(measured 9\.4\), /,
    );
  });

  it('heads the column "Billed" once any sandbox says what it is billed', () => {
    expect(billedHeader([unreported, billed])).toBe('Billed');
    expect(billedHeader([unreported])).toBe('Measured');
    expect(billedHeader([])).toBe('Measured');
  });
});

describe('ExitReason', () => {
  it('says out of balance in words, and what to do about it', () => {
    act(() => root.render(<ExitReason reason="insufficient_balance" />));
    expect(host.textContent).toBe('Out of balance');
    expect(host.querySelector('[title]')?.getAttribute('title')).toBe(
      'The bucket ran out of balance, so the node stopped it. Top up in Billing, then start it again.',
    );
  });

  it('shows any other reason as the node wrote it', () => {
    act(() => root.render(<ExitReason reason="timeout (600s)" />));
    expect(host.textContent).toBe('timeout (600s)');
  });
});
