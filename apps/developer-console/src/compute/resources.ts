/**
 * A sandbox's CPU and memory as a developer sets and reads them: the request
 * (guaranteed, and the least it is billed) and the limit (the most it can
 * use). The defaults are the platform's public ones: a create that leaves a
 * field out gets them from the cluster, so the console sends only what was
 * typed, as the cere CLI does.
 */
import { fmtCpu, fmtMib } from './format';
import type { Resources } from './types';

/** What a sandbox gets when its create names no request. */
export const SANDBOX_DEFAULTS = { cpu: 0.25, memoryMib: 256 } as const;
/** The highest CPU limit a cluster gives by default (`MAX_CPU_LIMIT`); the node's quota when that is lower. */
export const MAX_CPU_LIMIT = 8;
/** A memory limit left out is the larger of the request and this (`DEFAULT_MEMORY_LIMIT_MIB`). */
export const DEFAULT_MEMORY_LIMIT_MIB = 1024;
export const MIN_MEMORY_MIB = 128;

/** The memory limit a sandbox gets when its create names none. */
export const defaultMemoryLimit = (requestMib: number): number => Math.max(requestMib, DEFAULT_MEMORY_LIMIT_MIB);

/** What a person typed, as text; '' = the default. */
export interface ResourceFields {
  cpu: string;
  memoryMib: string;
  cpuLimit: string;
  memoryLimitMib: string;
}

export type ResourceErrors = Partial<Record<keyof ResourceFields, string>>;

export const EMPTY_RESOURCE_FIELDS: ResourceFields = { cpu: '', memoryMib: '', cpuLimit: '', memoryLimitMib: '' };

export interface ParsedResources {
  /** The create body's `resources`: only the fields that were typed. Empty: the cluster's defaults. */
  resources: Partial<Resources>;
  errors: ResourceErrors;
  /** What the sandbox will get, typed or default. `cpuLimit` null: the node's quota (at most `MAX_CPU_LIMIT`). */
  effective: { cpu: number; memoryMib: number; cpuLimit: number | null; memoryLimitMib: number };
}

const num = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Check what was typed and build the request. `defaults` is the request the
 * sandbox gets for an empty field (the platform's, or an agent runner's). A
 * limit must be at least the request it goes with, typed or default.
 */
export function parseResources(f: ResourceFields, defaults: { cpu: number; memoryMib: number } = SANDBOX_DEFAULTS) {
  const errors: ResourceErrors = {};
  const resources: Partial<Resources> = {};

  const cpu = num(f.cpu);
  if (cpu !== null) {
    if (!(cpu > 0)) errors.cpu = 'More than 0 vCPU, e.g. 0.5.';
    else resources.cpu = cpu;
  }
  const memory = num(f.memoryMib);
  if (memory !== null) {
    if (!Number.isInteger(memory) || memory < MIN_MEMORY_MIB) errors.memoryMib = `At least ${MIN_MEMORY_MIB} MiB.`;
    else resources.memory_mib = memory;
  }
  const effCpu = resources.cpu ?? defaults.cpu;
  const effMemory = resources.memory_mib ?? defaults.memoryMib;

  const cpuLimit = num(f.cpuLimit);
  if (cpuLimit !== null) {
    if (!(cpuLimit > 0)) errors.cpuLimit = 'More than 0 vCPU.';
    else if (cpuLimit < effCpu) errors.cpuLimit = `At least the request, ${fmtCpu(effCpu)}.`;
    else resources.cpu_limit = cpuLimit;
  }
  const memoryLimit = num(f.memoryLimitMib);
  if (memoryLimit !== null) {
    if (!Number.isInteger(memoryLimit) || memoryLimit < MIN_MEMORY_MIB)
      errors.memoryLimitMib = `At least ${MIN_MEMORY_MIB} MiB.`;
    else if (memoryLimit < effMemory) errors.memoryLimitMib = `At least the request, ${fmtMib(effMemory)}.`;
    else resources.memory_limit_mib = memoryLimit;
  }

  return {
    resources,
    errors,
    effective: {
      cpu: effCpu,
      memoryMib: effMemory,
      cpuLimit: resources.cpu_limit ?? null,
      memoryLimitMib: resources.memory_limit_mib ?? defaultMemoryLimit(effMemory),
    },
  } satisfies ParsedResources;
}

/** Before create: "0.25 vCPU guaranteed, bursts up to the node's quota (max 8)", or "… up to 4 vCPU". */
export function plannedCpu(e: ParsedResources['effective']): string {
  if (e.cpuLimit === null) return `${fmtCpu(e.cpu)} guaranteed, bursts up to the node’s quota (max ${MAX_CPU_LIMIT})`;
  if (e.cpuLimit <= e.cpu) return `${fmtCpu(e.cpu)} guaranteed, and no more`;
  return `${fmtCpu(e.cpu)} guaranteed, bursts up to ${fmtCpu(e.cpuLimit)}`;
}

/** Before create: "256 MiB guaranteed, up to 1 GiB". */
export function plannedMemory(e: ParsedResources['effective']): string {
  if (e.memoryLimitMib <= e.memoryMib) return `${fmtMib(e.memoryMib)} guaranteed, and no more`;
  return `${fmtMib(e.memoryMib)} guaranteed, up to ${fmtMib(e.memoryLimitMib)}`;
}

/**
 * A request with its limit, as a sandbox reports them: "0.25 vCPU guaranteed,
 * up to 4 vCPU". Without a limit (a gateway before limits, where the request
 * was the limit too) the request alone: "1 vCPU".
 */
function requestAndLimit(request: number, limit: number | undefined, fmt: (v: number) => string): string {
  if (!limit) return fmt(request);
  if (limit <= request) return `${fmt(request)} guaranteed, and no more`;
  return `${fmt(request)} guaranteed, up to ${fmt(limit)}`;
}

export const cpuLine = (r: Pick<Resources, 'cpu' | 'cpu_limit'>): string => requestAndLimit(r.cpu, r.cpu_limit, fmtCpu);

export const memoryLine = (r: Pick<Resources, 'memory_mib' | 'memory_limit_mib'>): string =>
  requestAndLimit(r.memory_mib, r.memory_limit_mib, fmtMib);

/** The most a sandbox can use: its limit, or its request where no limit is reported. */
export const cpuCeiling = (r: Pick<Resources, 'cpu' | 'cpu_limit'>): number => Math.max(r.cpu, r.cpu_limit ?? 0);
export const memoryCeiling = (r: Pick<Resources, 'memory_mib' | 'memory_limit_mib'>): number =>
  Math.max(r.memory_mib, r.memory_limit_mib ?? 0);

/** What a stored request (an agent definition's `resources`) gives, with `defaults` for what it leaves out. */
export function effectiveOf(
  r: Partial<Pick<Resources, 'cpu' | 'memory_mib' | 'cpu_limit' | 'memory_limit_mib'>> | undefined,
  defaults: { cpu: number; memoryMib: number },
): ParsedResources['effective'] {
  const cpu = r?.cpu || defaults.cpu;
  const memoryMib = r?.memory_mib || defaults.memoryMib;
  return {
    cpu,
    memoryMib,
    cpuLimit: r?.cpu_limit || null,
    memoryLimitMib: r?.memory_limit_mib || defaultMemoryLimit(memoryMib),
  };
}
