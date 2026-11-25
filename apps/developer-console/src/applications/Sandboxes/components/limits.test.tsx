// @vitest-environment happy-dom
/**
 * Requests and limits on the page: the form's defaults, its Limits disclosure
 * and checks; a sandbox's usage against an old and a new gateway; the memory
 * endings in words.
 */
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  EMPTY_RESOURCE_FIELDS,
  parseResources,
  SANDBOX_DEFAULTS,
  type ResourceFields,
} from '../../../compute/resources';
import { EMPTY_USAGE, type Sandbox, type Usage, type UsageRecord } from '../../../compute/types';
import RecordsTable from './detail/RecordsTable';
import UsageMeter from './detail/UsageMeter';
import ResourceInputs from './ResourceInputs';
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

/** Type into a React-controlled input the way a browser does. */
function type(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const input = (label: string): HTMLInputElement => {
  const l = [...host.querySelectorAll('label')].find((x) => x.textContent?.startsWith(label));
  const el = l && (document.getElementById(l.htmlFor) as HTMLInputElement | null);
  if (!el) throw new Error(`no input labelled ${label}`);
  return el;
};

/** The form as New sandbox uses it: what was typed, checked as it is typed; `sent` is the create's resources. */
let sent: unknown = null;
const Form = ({ initial = EMPTY_RESOURCE_FIELDS }: { initial?: ResourceFields }) => {
  const [v, setV] = useState(initial);
  const p = parseResources(v);
  sent = p.resources;
  return (
    <ResourceInputs
      value={v}
      onChange={(x) => setV((f) => ({ ...f, ...x }))}
      defaults={SANDBOX_DEFAULTS}
      errors={p.errors}
    />
  );
};

describe('the resources form', () => {
  it('shows the defaults plainly and sends none of them', () => {
    act(() => root.render(<Form />));
    expect(input('CPU request').placeholder).toBe('0.25');
    expect(input('Memory request').placeholder).toBe('128');
    expect(host.textContent).toContain('0.25 vCPU guaranteed, up to the node’s CPU for sandboxes (at most 8 vCPU)');
    expect(host.textContent).toContain('128 MiB guaranteed, up to 1 GiB');
    expect(host.textContent).toContain('You pay for the request for as long as it runs');
    // Units in the labels, never field names.
    expect(host.textContent).toContain('Memory request (MiB)');
    expect(host.textContent).not.toContain('memory_mib');
    expect(sent).toEqual({});
  });

  it('keeps the limits behind Limits until opened', () => {
    act(() => root.render(<Form />));
    const toggle = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Limits')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    act(() => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(input('CPU limit').placeholder).toBe('node’s quota, max 8');
    expect(input('Memory limit').placeholder).toBe('1024');
  });

  it('says what the sandbox will get as it is typed, and sends only that', () => {
    act(() => root.render(<Form />));
    act(() => type(input('CPU request'), '1'));
    act(() => type(input('Memory request'), '2048'));
    expect(host.textContent).toContain('1 vCPU guaranteed, up to the node’s CPU for sandboxes (at most 8 vCPU)');
    expect(host.textContent).toContain('2 GiB guaranteed, and no more');
    act(() => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Limits')!.click());
    expect(input('Memory limit').placeholder).toBe('2048');
    act(() => type(input('CPU limit'), '4'));
    act(() => type(input('Memory limit'), '4096'));
    expect(host.textContent).toContain('1 vCPU guaranteed, up to 4 vCPU');
    expect(host.textContent).toContain('2 GiB guaranteed, up to 4 GiB');
    expect(sent).toEqual({ cpu: 1, memory_mib: 2048, cpu_limit: 4, memory_limit_mib: 4096 });
  });

  it('refuses a limit below the request, and opens on limits already set', () => {
    act(() => root.render(<Form initial={{ ...EMPTY_RESOURCE_FIELDS, cpu: '2', cpuLimit: '1' }} />));
    const toggle = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Limits')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(host.textContent).toContain('At least the request, 2 vCPU.');
    // The sentence keeps to what will apply: the default limit until the typed one is usable.
    expect(host.textContent).toContain('2 vCPU guaranteed, up to the node’s CPU for sandboxes (at most 8 vCPU)');
    expect(sent).toEqual({ cpu: 2 });
  });
});

const sandbox = (over: { usage?: Partial<Usage>; resources?: Sandbox['resources'] }): Sandbox => ({
  id: 'sb-1',
  status: 'running',
  bucket: 4116,
  node: 'ab'.repeat(32),
  runtime: 'gvisor',
  image: 'python:3.12-slim',
  command: ['sleep', 'infinity'],
  workdir: '/workspace',
  resources: over.resources ?? { cpu: 1, memory_mib: 1024 },
  timeout_s: 600,
  idle_timeout_s: 0,
  env_keys: [],
  egress: { allow: [] },
  labels: {},
  created_at: '2026-11-25T10:00:00Z',
  started_at: '2026-11-25T10:00:01Z',
  ended_at: null,
  startup_ms: 200,
  exit_reason: null,
  exit_code: null,
  retained: [],
  usage: { ...EMPTY_USAGE, ...over.usage },
});

describe('a sandbox’s usage', () => {
  it('from a gateway before limits and billing: the request alone, as measured, no burst', () => {
    const sb = sandbox({ usage: { wall_s: 60, cpu_s: 6, ram_gib_s: 14, memory_peak_mib: 300 } });
    act(() => root.render(<UsageMeter sandbox={sb} cpuHistory={[]} />));
    expect(host.textContent).toContain('CPU6.00 CPU-smeasured');
    expect(host.textContent).toContain('uses 0.1 vCPU on average of 1 vCPU');
    expect(host.textContent).toContain('peak 300 MiB of 1 GiB');
    expect(host.textContent).not.toContain('burst');
    expect(host.textContent).not.toContain('guaranteed');
  });

  it('from a gateway before limits, billing reserved: the floor, and the burst worked out', () => {
    const sb = sandbox({
      usage: {
        wall_s: 60,
        cpu_s: 75,
        ram_gib_s: 30,
        memory_peak_mib: 900,
        billing_basis: 'reserved',
        reserved_cpu_s: 60,
        reserved_ram_gib_s: 60,
        billed_cpu_s: 75,
        billed_ram_gib_s: 60,
      },
    });
    act(() => root.render(<UsageMeter sandbox={sb} cpuHistory={[]} />));
    expect(host.textContent).toContain('CPU billed75.0 CPU-s60.0 request + 15.0 burst');
    expect(host.textContent).toContain('Memory billed60.0 GiB-s60.0 request, no burst');
  });

  it('with limits and burst billing: floor + burst, use against the request and the limit', () => {
    const sb = sandbox({
      resources: { cpu: 0.25, memory_mib: 256, cpu_limit: 4, memory_limit_mib: 1024 },
      usage: {
        wall_s: 60,
        cpu_s: 6.9,
        ram_gib_s: 14,
        memory_peak_mib: 700,
        billing_basis: 'request_or_usage',
        reserved_cpu_s: 15,
        reserved_ram_gib_s: 15,
        billed_cpu_s: 18.2,
        billed_ram_gib_s: 15,
        burst_cpu_s: 3.2,
        burst_ram_gib_s: 0,
        cpu_peak: 1,
      },
    });
    act(() => root.render(<UsageMeter sandbox={sb} cpuHistory={[0.1, 1, 0.2]} />));
    expect(host.textContent).toContain('CPU billed18.2 CPU-s15.0 request + 3.20 burst');
    expect(host.textContent).toContain('uses 0.12 vCPU on average, peak 1; 0.25 vCPU guaranteed, up to 4 vCPU');
    expect(host.textContent).toContain('peak 700 MiB; 256 MiB guaranteed, up to 1 GiB');
    const cpuCell = [...host.querySelectorAll('[title]')].find((e) => e.textContent?.startsWith('CPU billed'));
    expect(cpuCell?.getAttribute('title')).toBe(
      'billed 0.25 vCPU × 60.0 s = 15.0 CPU-s request + 3.2 CPU-s burst = 18.2 CPU-s (measured 6.9)',
    );
    // The memory bar runs to the limit, with the request marked.
    const meter = host.querySelector('[role="meter"]');
    expect(meter?.getAttribute('aria-valuemax')).toBe('1024');
    expect(meter?.getAttribute('aria-valuenow')).toBe('700');
  });
});

describe('memory billed below what was measured', () => {
  it('says the gap is file cache, not a negative burst', () => {
    const sb = sandbox({
      resources: { cpu: 0.25, memory_mib: 256, cpu_limit: 4, memory_limit_mib: 1024 },
      usage: {
        wall_s: 60,
        cpu_s: 3,
        ram_gib_s: 30,
        memory_peak_mib: 600,
        billing_basis: 'request_or_usage',
        reserved_cpu_s: 15,
        reserved_ram_gib_s: 15,
        billed_cpu_s: 15,
        billed_ram_gib_s: 20,
        burst_cpu_s: 0,
        burst_ram_gib_s: 5,
      },
    });
    act(() => root.render(<UsageMeter sandbox={sb} cpuHistory={[]} />));
    expect(host.textContent).toContain('Memory billed20.0 GiB-s15.0 request + 5.00 burst');
    expect(host.textContent).toContain('Measured 30.0 GiB-s, file cache is measured, not billed.');
  });
});

describe('memory endings', () => {
  it('reads out of memory as the limit, memory reclaimed as the request', () => {
    const sb = { resources: { memory_mib: 256, memory_limit_mib: 1024 }, usage: { memory_peak_mib: 700 } };
    act(() => root.render(<ExitReason reason="oom_killed" sb={sb} />));
    expect(host.textContent).toBe('Out of memory');
    expect(host.querySelector('[title]')?.getAttribute('title')).toBe(
      'It reached its memory limit of 1 GiB and was stopped. Raise the memory limit.',
    );
    act(() => root.render(<ExitReason reason="memory_reclaimed" sb={sb} />));
    expect(host.textContent).toBe('Memory reclaimed');
    expect(host.querySelector('[title]')?.getAttribute('title')).toContain('Raise the memory request to what it uses');
  });

  it('names the ending in plain words on the last minute of usage, with the burst under the bill', () => {
    const rec: UsageRecord = {
      record_id: 'r1',
      sandbox_id: 'sb-1',
      node: 'ab'.repeat(32),
      bucket: 4116,
      period_start: '2026-11-25T10:00:00Z',
      period_end: '2026-11-25T10:00:30Z',
      final: true,
      exit_reason: 'memory_reclaimed',
      cpu_s: 6.9,
      ram_gib_s: 14,
      memory_peak_mib: 700,
      net_egress_bytes: 0,
      net_ingress_bytes: 0,
      disk_peak_mib: 0,
      cpu_units: '1820000000000',
      ram_units: '1500000000000',
      tca_id: 1,
      dac_status: 'pushed',
      dac_updated_at: null,
      billing_basis: 'request_or_usage',
      wall_s: 30,
      reserved_cpu: 0.25,
      reserved_memory_mib: 256,
      reserved_cpu_s: 15,
      reserved_ram_gib_s: 15,
      billed_cpu_s: 18.2,
      billed_ram_gib_s: 15,
      burst_cpu_s: 3.2,
      burst_ram_gib_s: 0,
      cpu_limit: 4,
      memory_limit_mib: 1024,
    };
    act(() => root.render(<RecordsTable records={[rec]} />));
    expect(host.textContent).toContain('ended: Memory reclaimed');
    expect(host.textContent).toContain('18.23.20 burst');
    expect(host.textContent).not.toMatch(/DAC|TCA/);
    expect(host.querySelector('tbody tr')?.getAttribute('title')).toContain(
      'request_or_usage basis, request 0.25 vCPU, 256 MiB; limits 4 vCPU, 1 GiB',
    );
  });
});
