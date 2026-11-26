import { describe, expect, it } from 'vitest';

import {
  billedCPU,
  billedMemory,
  billedShort,
  billingLine,
  cores,
  countingState,
  fmtFixed,
  recordBilling,
  recordSumsLine,
} from './billing';
import { sumRecords } from './format';
import { EMPTY_USAGE, type Usage, type UsageRecord } from './types';

const usage = (u: Partial<Usage>): Usage => ({ ...EMPTY_USAGE, ...u });

// The cases of the cere CLI's TestBillingLine and TestQuickstart (ddc-node packages/cli/main_test.go).
describe('billingLine', () => {
  const steady = usage({
    wall_s: 54,
    cpu_s: 9.4,
    ram_gib_s: 15,
    billing_basis: 'request_or_usage',
    reserved_cpu_s: 54,
    reserved_ram_gib_s: 54,
    billed_cpu_s: 54,
    billed_ram_gib_s: 54,
  });

  it('says the request over the wall time, with what was measured', () => {
    expect(billingLine(steady, 1, 1024)).toBe(
      '1.0 vCPU × 54.0 s = 54.0 CPU-s request, no burst (measured 9.4), ' +
        '1.0 GiB × 54.0 s = 54.0 GiB-s request, no burst (measured 15.0)',
    );
  });

  it('reads the request from the usage when it is not known', () => {
    expect(billingLine(steady, 0, 0)).toBe(billingLine(steady, 1, 1024));
  });

  it('gives a fractional request the decimals it has', () => {
    const small = usage({
      wall_s: 10,
      cpu_s: 0.2,
      ram_gib_s: 1,
      billing_basis: 'request_or_usage',
      reserved_cpu_s: 2.5,
      reserved_ram_gib_s: 2.5,
      billed_cpu_s: 2.5,
      billed_ram_gib_s: 2.5,
    });
    expect(billingLine(small, 0.25, 256)).toBe(
      '0.25 vCPU × 10.0 s = 2.5 CPU-s request, no burst (measured 0.2), ' +
        '0.25 GiB × 10.0 s = 2.5 GiB-s request, no burst (measured 1.0)',
    );
  });

  it('rounds a half as the CLI does (to the even digit)', () => {
    const quickstart = usage({
      wall_s: 12.5,
      cpu_s: 1.25,
      ram_gib_s: 2.375,
      billing_basis: 'request_or_usage',
      reserved_cpu_s: 12.5,
      reserved_ram_gib_s: 12.5,
      billed_cpu_s: 12.5,
      billed_ram_gib_s: 12.5,
    });
    expect(billingLine(quickstart, 1, 1024)).toBe(
      '1.0 vCPU × 12.5 s = 12.5 CPU-s request, no burst (measured 1.2), ' +
        '1.0 GiB × 12.5 s = 12.5 GiB-s request, no burst (measured 2.4)',
    );
  });

  it('bills the use above the request as a burst', () => {
    const busy = usage({
      wall_s: 10,
      cpu_s: 20,
      ram_gib_s: 1,
      billing_basis: 'request_or_usage',
      reserved_cpu_s: 5,
      reserved_ram_gib_s: 2.5,
      billed_cpu_s: 20,
      billed_ram_gib_s: 2.5,
      burst_cpu_s: 15,
    });
    expect(billedCPU(busy, 0.5)).toBe(
      '0.5 vCPU × 10.0 s = 5.0 CPU-s request + 15.0 CPU-s burst = 20.0 CPU-s (measured 20.0)',
    );
    expect(billedMemory(busy, 256)).toBe('0.25 GiB × 10.0 s = 2.5 GiB-s request, no burst (measured 1.0)');
  });

  it('says what was measured under the measured basis', () => {
    const measured = usage({
      wall_s: 54,
      cpu_s: 9.4,
      ram_gib_s: 15,
      billing_basis: 'measured',
      reserved_cpu_s: 54,
      reserved_ram_gib_s: 54,
      billed_cpu_s: 9.4,
      billed_ram_gib_s: 15,
    });
    expect(billingLine(measured, 1, 1024)).toBe(
      '9.4 CPU-s as measured (reserved 1.0 vCPU × 54.0 s = 54.0), 15.0 GiB-s as measured (reserved 1.0 GiB × 54.0 s = 54.0)',
    );
  });

  it('says nothing before the node has reported', () => {
    expect(billingLine(usage({ wall_s: 54, cpu_s: 9.4 }), 1, 1024)).toBe('');
    expect(billingLine(usage({ wall_s: 54, cpu_s: 9.4, billing_basis: '' }), 1, 1024)).toBe('');
    expect(billedShort(usage({ wall_s: 54, cpu_s: 9.4 }))).toBeNull();
  });

  it('says a run billed less than its request was billed partly as measured (cli b2b367cc1)', () => {
    const mixed = usage({
      billing_basis: 'request_or_usage',
      wall_s: 10,
      cpu_s: 1,
      reserved_cpu_s: 10,
      billed_cpu_s: 4,
    });
    expect(billedCPU(mixed, 1)).toBe(
      '4.0 CPU-s, part of the run as measured (measured 1.0; reserved 1.0 vCPU × 10.0 s = 10.0)',
    );
    expect(billedShort(mixed)?.cpu).toBe('4.0 CPU-s, part as measured');
  });

  it('has a short form for table cells, without the arithmetic', () => {
    expect(billedShort(steady)).toEqual({ cpu: '54.0 CPU-s (measured 9.4)', memory: '54.0 GiB-s (measured 15.0)' });
    expect(
      billedShort(
        usage({
          billing_basis: 'request_or_usage',
          cpu_s: 20,
          reserved_cpu_s: 5,
          billed_cpu_s: 20,
          burst_cpu_s: 15,
          ram_gib_s: 1,
        }),
      )?.cpu,
    ).toBe('20.0 CPU-s, 15.0 burst (measured 20.0)');
    expect(billedShort(usage({ billing_basis: 'measured', cpu_s: 9.4, billed_cpu_s: 9.4 }))?.cpu).toBe(
      '9.4 CPU-s as measured',
    );
  });
});

describe('numbers as the CLI prints them', () => {
  it('cores: a reservation with the decimals it has, to a thousandth', () => {
    expect(cores(1)).toBe('1.0');
    expect(cores(0.25)).toBe('0.25');
    expect(cores(0.5)).toBe('0.5');
    expect(cores(2)).toBe('2.0');
    expect(cores(1 / 3)).toBe('0.333');
    expect(cores(0)).toBe('0.0');
  });

  it('fmtFixed: Go’s %.Nf, which rounds an exact half to even', () => {
    expect(fmtFixed(1.25, 1)).toBe('1.2');
    expect(fmtFixed(1.75, 1)).toBe('1.8');
    expect(fmtFixed(0.25, 1)).toBe('0.2');
    expect(fmtFixed(2.375, 1)).toBe('2.4');
    expect(fmtFixed(1.05, 1)).toBe('1.1'); // not a half in binary: as toFixed
    expect(fmtFixed(9.4, 1)).toBe('9.4');
    expect(fmtFixed(54, 1)).toBe('54.0');
    expect(fmtFixed(0.0625, 3)).toBe('0.062');
    expect(fmtFixed(60, 3)).toBe('60.000');
    expect(fmtFixed(-0.25, 1)).toBe('-0.2');
  });
});

const record = (r: Partial<UsageRecord>): UsageRecord => ({
  record_id: 'r',
  sandbox_id: 'sb',
  node: 'n',
  bucket: 1,
  labels: {},
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
  tca_id: 1,
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

// The cases of the cere CLI's TestEgressAndUsage (`cere usage`).
describe('usage records', () => {
  const minute = record({
    cpu_s: 9.4,
    ram_gib_s: 15,
    cpu_units: '6000000000000',
    ram_units: '6000000000000',
    wall_s: 60,
    reserved_cpu: 1,
    reserved_memory_mib: 1024,
    reserved_cpu_s: 60,
    reserved_ram_gib_s: 60,
    billed_cpu_s: 60,
    billed_ram_gib_s: 60,
    cpu_limit: 2,
    memory_limit: 2048,
  });
  const measured = record({
    billing_basis: 'measured',
    cpu_s: 2,
    ram_gib_s: 3,
    wall_s: 60,
    reserved_cpu: 0.25,
    reserved_memory_mib: 512,
    reserved_cpu_s: 15,
    reserved_ram_gib_s: 30,
    billed_cpu_s: 2,
    billed_ram_gib_s: 3,
  });

  it('give a record’s basis, request and billed amounts', () => {
    expect(recordBilling(minute)).toEqual({
      basis: 'request_or_usage',
      reserved: '1.0 vCPU, 1.0 GiB',
      cpu: 60,
      ram: 60,
    });
    expect(recordBilling(measured)).toEqual({ basis: 'measured', reserved: '0.25 vCPU, 0.5 GiB', cpu: 2, ram: 3 });
  });

  it('sum billed and measured, in words', () => {
    expect(recordSumsLine(sumRecords([minute]))).toBe(
      'billed 60.0 CPU-s and 60.0 GiB-s; measured 9.40 CPU-s and 15.0 GiB-s',
    );
    expect(recordSumsLine(sumRecords([measured]))).toBe(
      'billed 2.00 CPU-s and 3.00 GiB-s; measured 2.00 CPU-s and 3.00 GiB-s',
    );
    const all = sumRecords([minute, measured]);
    expect(all.billed_cpu_s).toBe(62);
    expect(all.reserved_cpu_s).toBe(75);
    expect(all.cpu_s).toBeCloseTo(11.4);
  });
});

describe('countingState', () => {
  it('is the worst state of the records: refused, then waiting, then counted', () => {
    expect(countingState([])).toBeNull();
    expect(countingState([{ dac_status: 'pushed' }, { dac_status: 'pushed' }])).toBe('pushed');
    expect(countingState([{ dac_status: 'pushed' }, { dac_status: 'pending' }])).toBe('pending');
    expect(countingState([{ dac_status: 'pending' }, { dac_status: 'failed' }])).toBe('failed');
  });
});
