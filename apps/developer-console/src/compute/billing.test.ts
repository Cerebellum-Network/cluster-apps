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
  unitsToFloat,
} from './billing';
import { sumRecords } from './format';
import { EMPTY_USAGE, type Usage, type UsageRecord } from './types';

const usage = (u: Partial<Usage>): Usage => ({ ...EMPTY_USAGE, ...u });

// The cases of the cere CLI's TestBillingLine and TestQuickstart (ddc-node client/cere/main_test.go, cli/v0.1.5).
describe('billingLine', () => {
  const reserved = usage({
    wall_s: 54,
    cpu_s: 9.4,
    ram_gib_s: 15,
    billing_basis: 'reserved',
    reserved_cpu_s: 54,
    reserved_ram_gib_s: 54,
    billed_cpu_s: 54,
    billed_ram_gib_s: 54,
  });

  it('says the reservation over the wall time, with what was measured', () => {
    expect(billingLine(reserved, 1, 1024)).toBe(
      '1.0 vCPU × 54.0 s = 54.0 CPU-s (measured 9.4), 1.0 GiB × 54.0 s = 54.0 GiB-s (measured 15.0)',
    );
  });

  it('reads the reservation from the usage when it is not known', () => {
    expect(billingLine(reserved, 0, 0)).toBe(billingLine(reserved, 1, 1024));
  });

  it('gives a fractional reservation the decimals it has', () => {
    const small = usage({
      wall_s: 10,
      cpu_s: 0.2,
      ram_gib_s: 1,
      billing_basis: 'reserved',
      reserved_cpu_s: 2.5,
      reserved_ram_gib_s: 2.5,
      billed_cpu_s: 2.5,
      billed_ram_gib_s: 2.5,
    });
    expect(billingLine(small, 0.25, 256)).toBe(
      '0.25 vCPU × 10.0 s = 2.5 CPU-s (measured 0.2), 0.25 GiB × 10.0 s = 2.5 GiB-s (measured 1.0)',
    );
  });

  it('rounds a half as the CLI does (to the even digit)', () => {
    const quickstart = usage({
      wall_s: 12.5,
      cpu_s: 1.25,
      ram_gib_s: 2.375,
      billing_basis: 'reserved',
      reserved_cpu_s: 12.5,
      reserved_ram_gib_s: 12.5,
      billed_cpu_s: 12.5,
      billed_ram_gib_s: 12.5,
    });
    expect(billingLine(quickstart, 1, 1024)).toBe(
      '1.0 vCPU × 12.5 s = 12.5 CPU-s (measured 1.2), 1.0 GiB × 12.5 s = 12.5 GiB-s (measured 2.4)',
    );
  });

  it('bills what was measured where it is more than the reservation', () => {
    const busy = usage({
      wall_s: 10,
      cpu_s: 20,
      ram_gib_s: 1,
      billing_basis: 'reserved',
      reserved_cpu_s: 5,
      reserved_ram_gib_s: 2.5,
      billed_cpu_s: 20,
      billed_ram_gib_s: 2.5,
    });
    expect(billedCPU(busy, 0.5)).toBe(
      '20.0 CPU-s, the larger of reserved and measured per minute (measured 20.0; reserved 0.5 vCPU × 10.0 s = 5.0)',
    );
    expect(billedMemory(busy, 256)).toBe('0.25 GiB × 10.0 s = 2.5 GiB-s (measured 1.0)');
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

  it('says nothing for a gateway without the billing fields, or before the node has reported', () => {
    expect(billingLine(usage({ wall_s: 54, cpu_s: 9.4 }), 1, 1024)).toBe('');
    expect(billingLine(usage({ wall_s: 54, cpu_s: 9.4, billing_basis: '' }), 1, 1024)).toBe('');
    expect(billedShort(usage({ wall_s: 54, cpu_s: 9.4 }))).toBeNull();
  });

  it('says a run billed less than its reservation was billed partly as measured (cli b2b367cc1)', () => {
    const mixed = usage({ billing_basis: 'reserved', wall_s: 10, cpu_s: 1, reserved_cpu_s: 10, billed_cpu_s: 4 });
    expect(billedCPU(mixed, 1)).toBe(
      '4.0 CPU-s, part of the run as measured (measured 1.0; reserved 1.0 vCPU × 10.0 s = 10.0)',
    );
    expect(billedShort(mixed)?.cpu).toBe('4.0 CPU-s, part as measured');
  });

  it('has a short form for table cells, without the arithmetic', () => {
    expect(billedShort(reserved)).toEqual({ cpu: '54.0 CPU-s (measured 9.4)', memory: '54.0 GiB-s (measured 15.0)' });
    expect(
      billedShort(usage({ billing_basis: 'reserved', cpu_s: 20, reserved_cpu_s: 5, billed_cpu_s: 20, ram_gib_s: 1 }))
        ?.cpu,
    ).toBe('20.0 CPU-s (measured 20.0)');
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

  it('unitsToFloat: DAC units / 1e11, 0 for anything else', () => {
    expect(unitsToFloat('150000000000')).toBe(1.5);
    expect(unitsToFloat('')).toBe(0);
    expect(unitsToFloat('x')).toBe(0);
    expect(unitsToFloat(undefined)).toBe(0);
    expect(unitsToFloat('18446744073709551616')).toBe(0); // above uint64
  });
});

const record = (r: Partial<UsageRecord>): UsageRecord => ({
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
  tca_id: 1,
  dac_status: 'pushed',
  dac_updated_at: null,
  ...r,
});

// The cases of the cere CLI's TestEgressAndUsage (`cere usage`).
describe('usage records', () => {
  const reserved = record({
    cpu_s: 9.4,
    ram_gib_s: 15,
    cpu_units: '6000000000000',
    ram_units: '6000000000000',
    billing_basis: 'reserved',
    wall_s: 60,
    reserved_cpu: 1,
    reserved_memory_mib: 1024,
    reserved_cpu_s: 60,
    reserved_ram_gib_s: 60,
    billed_cpu_s: 60,
    billed_ram_gib_s: 60,
  });
  const older = [
    record({ cpu_s: 0.5, ram_gib_s: 1.5, cpu_units: '50000000000', ram_units: '150000000000' }),
    record({ cpu_s: 1.5, ram_gib_s: 1.5, cpu_units: '150000000000', ram_units: '150000000000' }),
  ];

  it('give a record’s basis, reservation and billed amounts', () => {
    expect(recordBilling(reserved)).toEqual({ basis: 'reserved', reserved: '1.0 vCPU, 1.0 GiB', cpu: 60, ram: 60 });
    expect(recordBilling(record({ billing_basis: 'reserved', reserved_cpu: 0.25, reserved_memory_mib: 512 }))).toEqual({
      basis: 'reserved',
      reserved: '0.25 vCPU, 0.5 GiB',
      cpu: 0,
      ram: 0,
    });
  });

  it('bill their units where the gateway predates the billing fields', () => {
    expect(recordBilling(older[0])).toEqual({ basis: '—', reserved: '—', cpu: 0.5, ram: 1.5 });
  });

  it('sum billed and measured, as cere usage does', () => {
    expect(recordSumsLine(sumRecords([reserved]))).toBe(
      'billed 60.000 CPU-s, 60.000 GiB-s (measured 9.400 CPU-s, 15.000 GiB-s)',
    );
    expect(recordSumsLine(sumRecords(older))).toBe(
      'billed 2.000 CPU-s, 3.000 GiB-s (measured 2.000 CPU-s, 3.000 GiB-s)',
    );
    const all = sumRecords([reserved, ...older]);
    expect(all.billed_cpu_s).toBe(62);
    expect(all.reserved_cpu_s).toBe(60);
    expect(all.cpu_s).toBeCloseTo(11.4);
    expect(Number.isNaN(all.reserved_ram_gib_s)).toBe(false);
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
