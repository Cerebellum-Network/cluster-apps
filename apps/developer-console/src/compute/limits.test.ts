/**
 * Requests, limits and burst billing (contract of 25 Nov): the form's defaults
 * and checks, the floor/burst arithmetic on records, and the words a developer
 * reads.
 */
import { describe, expect, it } from 'vitest';

import {
  billedParts,
  billedShort,
  billingLine,
  measuredIncludesCache,
  partsLine,
  recordParts,
  recordSumsLine,
  shownParts,
  shownPartsLine,
  usageParts,
  type RecordBillingFields,
} from './billing';
import { exitReasonInfo, memoryEnding } from './exitReasons';
import { sumRecords } from './format';
import {
  cpuCeiling,
  cpuLine,
  EMPTY_RESOURCE_FIELDS,
  memoryCeiling,
  memoryLine,
  parseDisk,
  parseResources,
  plannedCpu,
  plannedMemory,
} from './resources';
import { EMPTY_USAGE, type Usage, type UsageRecord } from './types';

const fields = (f: Partial<typeof EMPTY_RESOURCE_FIELDS>) => ({ ...EMPTY_RESOURCE_FIELDS, ...f });

describe('the resources form', () => {
  it('sends nothing when nothing is typed, and says what the defaults give', () => {
    const p = parseResources(EMPTY_RESOURCE_FIELDS);
    expect(p.resources).toEqual({});
    expect(p.errors).toEqual({});
    expect(p.effective).toEqual({ cpu: 0.25, memoryMib: 128, cpuLimit: null, memoryLimitMib: 1024 });
    expect(plannedCpu(p.effective)).toBe('0.25 vCPU guaranteed, up to the node’s CPU for sandboxes (at most 8 vCPU)');
    expect(plannedMemory(p.effective)).toBe('128 MiB guaranteed, up to 1 GiB');
  });

  it('sends only the fields typed; the limits only when set', () => {
    expect(parseResources(fields({ cpu: '0.5' })).resources).toEqual({ cpu: 0.5 });
    expect(parseResources(fields({ memoryMib: ' 512 ' })).resources).toEqual({ memory: 512 });
    const p = parseResources(fields({ cpu: '1', memoryMib: '512', cpuLimit: '4', memoryLimitMib: '2048' }));
    expect(p.resources).toEqual({ cpu: 1, memory: 512, cpu_limit: 4, memory_limit: 2048 });
    expect(plannedCpu(p.effective)).toBe('1 vCPU guaranteed, up to 4 vCPU');
    expect(plannedMemory(p.effective)).toBe('512 MiB guaranteed, up to 2 GiB');
  });

  it('defaults the memory limit to the larger of the request and 1 GiB', () => {
    expect(parseResources(fields({ memoryMib: '2048' })).effective.memoryLimitMib).toBe(2048);
    expect(parseResources(fields({ memoryMib: '512' })).effective.memoryLimitMib).toBe(1024);
    expect(plannedMemory(parseResources(fields({ memoryMib: '2048' })).effective)).toBe(
      '2 GiB guaranteed, and no more',
    );
  });

  it('refuses a limit below its request, typed or default', () => {
    expect(parseResources(fields({ cpu: '2', cpuLimit: '1' })).errors).toEqual({
      cpuLimit: 'At least the request, 2 vCPU.',
    });
    expect(parseResources(fields({ cpuLimit: '0.1' })).errors).toEqual({
      cpuLimit: 'At least the request, 0.25 vCPU.',
    });
    expect(parseResources(fields({ memoryMib: '1024', memoryLimitMib: '512' })).errors).toEqual({
      memoryLimitMib: 'At least the request, 1 GiB.',
    });
    expect(parseResources(fields({ memoryLimitMib: '200', memoryMib: '256' })).errors).toEqual({
      memoryLimitMib: 'At least the request, 256 MiB.',
    });
    // Equal is allowed: no burst.
    const eq = parseResources(fields({ cpu: '1', cpuLimit: '1', memoryMib: '512', memoryLimitMib: '512' }));
    expect(eq.errors).toEqual({});
    expect(plannedCpu(eq.effective)).toBe('1 vCPU guaranteed, and no more');
  });

  it('refuses what is not a size', () => {
    const p = parseResources(fields({ cpu: '0', memoryMib: '100', cpuLimit: 'x', memoryLimitMib: '1.5' }));
    expect(p.errors).toEqual({
      cpu: 'More than 0 vCPU, e.g. 0.5.',
      memoryMib: 'At least 128 MiB.',
      cpuLimit: 'More than 0 vCPU.',
      memoryLimitMib: 'At least 128 MiB.',
    });
    expect(p.resources).toEqual({});
  });

  it('takes another set of defaults (an agent runner’s)', () => {
    const p = parseResources(fields({ cpuLimit: '0.5' }), { cpu: 1, memoryMib: 2048 });
    expect(p.errors.cpuLimit).toBe('At least the request, 1 vCPU.');
    expect(parseResources(EMPTY_RESOURCE_FIELDS, { cpu: 1, memoryMib: 2048 }).effective.memoryLimitMib).toBe(2048);
  });
});

describe('the disk field', () => {
  it('leaves the disk out when empty (the API gives 512 MiB), else sends whole MiB', () => {
    expect(parseDisk('')).toEqual({});
    expect(parseDisk(' 2048 ')).toEqual({ disk: 2048 });
    expect(parseDisk('100000')).toEqual({ disk: 100000 });
    for (const bad of ['0', '-1', '1.5', 'x'])
      expect(parseDisk(bad)).toEqual({ error: 'A whole number of MiB, 1 or more.' });
  });
});

describe('a sandbox’s request and limit', () => {
  it('reads "guaranteed, up to" when the sandbox reports a limit', () => {
    expect(cpuLine({ cpu: 0.25, cpu_limit: 4 })).toBe('0.25 vCPU guaranteed, up to 4 vCPU');
    expect(memoryLine({ memory: 256, memory_limit: 1024 })).toBe('256 MiB guaranteed, up to 1 GiB');
    expect(cpuLine({ cpu: 1, cpu_limit: 1 })).toBe('1 vCPU guaranteed, and no more');
  });

  it('shows the request alone without a limit', () => {
    expect(cpuLine({ cpu: 1 })).toBe('1 vCPU');
    expect(memoryLine({ memory: 1024 })).toBe('1 GiB');
    expect(cpuCeiling({ cpu: 1 })).toBe(1);
    expect(memoryCeiling({ memory: 1024, memory_limit: 4096 })).toBe(4096);
  });
});

const record = (r: Partial<UsageRecord>): RecordBillingFields & UsageRecord => ({
  record_id: 'r',
  sandbox_id: 'sb',
  node: 'n',
  bucket: 1,
  period_start: '2026-11-25T10:00:00Z',
  period_end: '2026-11-25T10:01:00Z',
  final: false,
  exit_reason: null,
  cpu_s: 0,
  ram_gib_s: 0,
  memory_peak_mib: 0,
  net_egress_bytes: 0,
  net_ingress_bytes: 0,
  disk_peak_mib: 0,
  cpu_units: '0',
  ram_units: '0',
  tca_id: 0,
  dac_status: 'pushed',
  dac_updated_at: null,
  billing_basis: 'request_or_usage',
  wall_s: 0,
  reserved_cpu: 0,
  reserved_memory_mib: 0,
  reserved_cpu_s: 0,
  reserved_ram_gib_s: 0,
  billed_cpu_s: 0,
  billed_ram_gib_s: 0,
  cpu_limit: 0,
  memory_limit: 0,
  burst_cpu_s: 0,
  burst_ram_gib_s: 0,
  cpu_peak: 0,
  ...r,
});

// A 60 s minute of a 0.25 vCPU / 256 MiB sandbox that burst to 1 vCPU for 4.3 s.
const burstMinute = record({
  billing_basis: 'request_or_usage',
  wall_s: 60,
  cpu_s: 6.9,
  ram_gib_s: 14,
  reserved_cpu: 0.25,
  reserved_memory_mib: 256,
  reserved_cpu_s: 15,
  reserved_ram_gib_s: 15,
  billed_cpu_s: 18.2,
  billed_ram_gib_s: 15,
  burst_cpu_s: 3.2,
  burst_ram_gib_s: 0,
  cpu_limit: 4,
  memory_limit: 1024,
  cpu_peak: 1,
});
const measuredMinute = record({
  billing_basis: 'measured',
  wall_s: 60,
  cpu_s: 9.4,
  ram_gib_s: 15,
  reserved_cpu_s: 60,
  reserved_ram_gib_s: 60,
  billed_cpu_s: 9.4,
  billed_ram_gib_s: 15,
});

describe('floor and burst', () => {
  it('takes the floor and the burst from the record’s own fields', () => {
    expect(recordParts(burstMinute)).toEqual({
      cpu: { floor: 15, burst: 3.2, asMeasured: 0, billed: 18.2 },
      ram: { floor: 15, burst: 0, asMeasured: 0, billed: 15 },
    });
  });

  it('never shows a burst above the bill: the floor is what is left of it', () => {
    // Billed less than its floor (its node changed basis mid-run): no burst, the floor is what was billed.
    expect(billedParts('request_or_usage', 40, 0)).toEqual({ floor: 40, burst: 0, asMeasured: 0, billed: 40 });
    expect(billedParts('request_or_usage', 2, 5)).toEqual({ floor: 0, burst: 2, asMeasured: 0, billed: 2 });
  });

  it('has no floor or burst under the measured basis', () => {
    expect(recordParts(measuredMinute).cpu).toEqual({ floor: 0, burst: 0, asMeasured: 9.4, billed: 9.4 });
  });

  it('sums the parts so they add up to the bill', () => {
    const t = sumRecords([burstMinute, measuredMinute]);
    expect(t.cpu.floor).toBeCloseTo(15);
    expect(t.cpu.burst).toBeCloseTo(3.2);
    expect(t.cpu.asMeasured).toBeCloseTo(9.4);
    expect(t.billed_cpu_s).toBeCloseTo(27.6);
    expect(t.cpu.floor + t.cpu.burst + t.cpu.asMeasured).toBeCloseTo(t.billed_cpu_s);
    expect(t.burst_cpu_s).toBeCloseTo(3.2);
    expect(t.ram.burst).toBe(0);
  });

  it('says the parts in words', () => {
    expect(partsLine(recordParts(burstMinute).cpu)).toBe('15.0 request + 3.2 burst');
    expect(partsLine(recordParts(burstMinute).ram)).toBe('15.0 request, no burst');
    expect(partsLine(recordParts(measuredMinute).cpu)).toBe('9.4 as measured');
    expect(partsLine({ floor: 0, burst: 0, asMeasured: 0, billed: 0 })).toBe('');
    expect(partsLine(sumRecords([burstMinute, measuredMinute]).cpu)).toBe('15.0 request + 3.2 burst + 9.4 as measured');
  });

  it('puts the burst in the sums line only when there was some', () => {
    expect(recordSumsLine(sumRecords([burstMinute]))).toBe(
      'billed 18.2 CPU-s (15.0 request + 3.2 burst) and 15.0 GiB-s; measured 6.90 CPU-s and 14.0 GiB-s',
    );
    expect(recordSumsLine(sumRecords([measuredMinute]))).toBe(
      'billed 9.40 CPU-s and 15.0 GiB-s; measured 9.40 CPU-s and 15.0 GiB-s',
    );
  });

  it('shows a bill’s parts at its total’s precision, so they add up to it', () => {
    // devnet, sb-01m8aaqf5mk704ea7q86y68qag: 74.4 CPU-s billed read "19.8 request + 54.7 burst" before.
    const p = shownParts({ floor: 19.79, burst: 54.66, asMeasured: 0, billed: 74.45 - 0.01 });
    expect(p.parts).toEqual({ floor: 19.8, burst: 54.6, asMeasured: 0, billed: 74.4 });
    expect(shownPartsLine({ floor: 1727.2, burst: 79.04, asMeasured: 0, billed: 1806.24 })).toBe(
      '1,727 request + 79 burst',
    );
    expect(shownPartsLine({ floor: 7.7, burst: 0.05, asMeasured: 0, billed: 7.75 })).toBe('7.70 request + 0.05 burst');
  });
});

const usage = (u: Partial<Usage>): Usage => ({ ...EMPTY_USAGE, ...u });

describe('a sandbox’s live usage on request_or_usage', () => {
  const live = usage({
    wall_s: 60,
    cpu_s: 6.9,
    ram_gib_s: 14,
    billing_basis: 'request_or_usage',
    reserved_cpu_s: 15,
    reserved_ram_gib_s: 15,
    billed_cpu_s: 18.2,
    billed_ram_gib_s: 15,
    burst_cpu_s: 3.2,
    burst_ram_gib_s: 0,
    cpu_peak: 1,
  });

  it('bills the floor plus the burst, as one line', () => {
    expect(billingLine(live, 0.25, 256)).toBe(
      '0.25 vCPU × 60.0 s = 15.0 CPU-s request + 3.2 CPU-s burst = 18.2 CPU-s (measured 6.9), ' +
        '0.25 GiB × 60.0 s = 15.0 GiB-s request, no burst (measured 14.0)',
    );
    expect(billedShort(live)).toEqual({
      cpu: '18.2 CPU-s, 3.2 burst (measured 6.9)',
      memory: '15.0 GiB-s (measured 14.0)',
    });
    expect(usageParts(live)?.cpu).toEqual({ floor: 15, burst: 3.2, asMeasured: 0, billed: 18.2 });
  });

  it('takes the memory burst from the field, never from what was measured', () => {
    // Working set billed (page cache is not): billed memory below measured, with a burst above the request.
    const cache = usage({ ...live, ram_gib_s: 30, billed_ram_gib_s: 20, burst_ram_gib_s: 5 });
    expect(usageParts(cache)?.ram).toEqual({ floor: 15, burst: 5, asMeasured: 0, billed: 20 });
    expect(measuredIncludesCache(30, 20)).toBe(true);
    expect(measuredIncludesCache(15.02, 15)).toBe(false);
  });

  it('has no parts before the node reports billing', () => {
    expect(usageParts(usage({ wall_s: 5, cpu_s: 1 }))).toBeNull();
  });
});

describe('memory endings in plain words', () => {
  it('says out of memory is the limit: raise the limit', () => {
    const i = exitReasonInfo('oom_killed', { resources: { memory: 256, memory_limit: 1024 } });
    expect(i).toEqual({
      label: 'Out of memory',
      detail: 'It reached its memory limit of 1 GiB and was stopped.',
      action: 'Raise the memory limit.',
    });
  });

  it('says memory reclaimed is the request: raise the request', () => {
    const i = exitReasonInfo('memory_reclaimed', {
      resources: { memory: 256, memory_limit: 1024 },
      usage: { memory_peak_mib: 700 },
    });
    expect(i.label).toBe('Memory reclaimed');
    expect(i.detail).toBe(
      'It used more memory than its request of 256 MiB (up to 700 MiB) while its node was short of memory, so the node stopped it to free memory.',
    );
    expect(i.action).toBe('Raise the memory request to what it uses: memory within the request is never reclaimed.');
  });

  it('keeps other reasons as the node wrote them', () => {
    expect(exitReasonInfo('timeout (600s)')).toEqual({ label: 'timeout (600s)' });
    expect(memoryEnding('oom_killed')).toBe(true);
    expect(memoryEnding('memory_reclaimed')).toBe(true);
    expect(memoryEnding('exited with code 137')).toBe(false);
    expect(memoryEnding(null)).toBe(false);
  });
});
