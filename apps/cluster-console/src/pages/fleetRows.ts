import type { FleetView } from '~/api/metricsTypes';
import type { ChainSnapshot, DACUsage, DACView, NodesView } from '~/api/types';

/**
 * One row per node the cluster runs, whatever it does: storage and cache
 * machines (with the sandbox runtime they may host), inference nodes and
 * agent runtimes. The same columns for all; what a node runs is a column,
 * never a group.
 */
export interface FleetRow {
  key: string;
  name: string;
  /** Under the name: the instance or host, when it says more. */
  detail: string;
  /** What the node runs, in words: "Storage · sandboxes", "Cache", "Inference: gemma4_31b". */
  runs: string;
  status: 'up' | 'down' | 'silent' | 'unknown';
  lastSeen: string | null;
  availability: number | null;
  uptimeS: number | null;
  version: string | null;
  cpuCores: number | null;
  cpuUsed: number | null;
  memTotal: number | null;
  memUsed: number | null;
  /** Disk for storage and cache, VRAM for inference. */
  space: { kind: 'disk' | 'vram'; used: number | null; total: number | null } | null;
  /** DAC-verified work over the last 24 h, when the node has a key on chain. */
  work: DACUsage | null;
  onChain: boolean;
  /** For the detail view: keys and endpoints. */
  facts: [string, string][];
}

const SILENT_MS = 2 * 60_000;

function statusOf(
  up: boolean | null | undefined,
  lastSeen: string | null | undefined,
  now: number,
): FleetRow['status'] {
  if (lastSeen && now - Date.parse(lastSeen) > SILENT_MS) return 'silent';
  if (up === true) return 'up';
  if (up === false) return 'down';
  return 'unknown';
}

const MODE: Record<string, string> = { storage: 'Storage', full: 'Storage', cache: 'Cache' };

export function fleetRows(
  fleet: FleetView | null,
  nodes: NodesView | null,
  chain: ChainSnapshot | null,
  dac: DACView | null,
  now: number = Date.now(),
): FleetRow[] {
  const rows: FleetRow[] = [];
  const registry = nodes?.items ?? [];
  const sandboxByHost = new Map(registry.filter((n) => n.sandbox).map((n) => [n.host.replace(/:\d+$/, ''), n]));
  const work = (key: string) => dac?.nodes[key.toLowerCase().replace(/^0x/, '')] ?? null;
  const seenHosts = new Set<string>();

  for (const m of fleet?.machines ?? []) {
    const sbx = m.host ? sandboxByHost.get(m.host) : undefined;
    const chainNode = chain?.nodes.find((c) => c.pub_key.toLowerCase() === m.key);
    seenHosts.add(m.host);
    rows.push({
      key: `m:${m.key || m.instance}`,
      name: m.host || m.instance,
      detail: m.host ? m.instance : '',
      runs: [MODE[m.mode] ?? (m.mode || 'Storage'), sbx ? 'sandboxes' : ''].filter(Boolean).join(' · '),
      status: statusOf(m.up, m.last_seen, now),
      lastSeen: m.last_seen,
      availability: m.availability_7d,
      uptimeS: m.uptime_s,
      version: m.version,
      cpuCores: m.cpu_cores,
      cpuUsed: m.cpu_used,
      memTotal: m.memory_total_bytes,
      memUsed: m.memory_used_bytes,
      space: { kind: 'disk', used: m.disk_used_bytes, total: m.disk_total_bytes },
      work: m.key ? work(m.key) : null,
      onChain: m.on_chain,
      facts: [
        ['Node key', m.key ? `0x${m.key}` : '—'],
        ['Provider', chainNode?.provider ? `0x${chainNode.provider}` : '—'],
        ['Mode on chain', m.mode || 'not on chain'],
        ['Metrics instance', m.instance],
        ...(sbx
          ? ([
              [
                'Sandbox runtime',
                `${sbx.healthy ? 'healthy' : 'not healthy'} · ${sbx.sandbox?.runsc ? `runsc ${sbx.sandbox.runsc}` : ''}`,
              ],
              ['Sandbox node key', sbx.id],
            ] as [string, string][])
          : []),
      ],
    });
  }
  // Machines on chain the metrics don't know: listed, with nothing guessed.
  for (const c of chain?.nodes ?? []) {
    if (c.mode === 'compute' || seenHosts.has(c.host)) continue;
    rows.push({
      key: `c:${c.pub_key}`,
      name: c.host,
      detail: '',
      runs: MODE[c.mode] ?? c.mode,
      status: 'unknown',
      lastSeen: null,
      availability: null,
      uptimeS: null,
      version: null,
      cpuCores: null,
      cpuUsed: null,
      memTotal: null,
      memUsed: null,
      space: null,
      work: work(c.pub_key),
      onChain: true,
      facts: [
        ['Node key', `0x${c.pub_key}`],
        ['Provider', `0x${c.provider}`],
      ],
    });
  }

  const infMetrics = new Map((fleet?.inference ?? []).map((i) => [i.node, i]));
  for (const n of registry.filter((x) => !x.sandbox && x.inference)) {
    const im = infMetrics.get(n.id) ?? infMetrics.get(n.host);
    const ready = n.inference?.models.filter((x) => x.status === 'ready').map((x) => x.name) ?? [];
    const vramTotal = n.inference?.devices.reduce((a, d) => a + d.vram_total_bytes, 0) ?? 0;
    const vramUsed = n.inference?.devices.reduce((a, d) => a + d.vram_used_bytes, 0) ?? 0;
    rows.push({
      key: `i:${n.id}`,
      name: n.id,
      detail: n.inference?.devices.length
        ? n.inference.devices.map((d) => d.model.replace('NVIDIA ', '')).join(', ')
        : 'remote API',
      runs: `Inference${ready.length ? `: ${ready.slice(0, 2).join(', ')}${ready.length > 2 ? ` +${ready.length - 2}` : ''}` : ' (standby)'}`,
      status: n.healthy ? (im ? statusOf(im.up, im.last_seen, now) : 'up') : 'down',
      lastSeen: n.last_seen,
      availability: null,
      uptimeS: null,
      version: im?.version ?? null,
      cpuCores: null,
      cpuUsed: null,
      memTotal: null,
      memUsed: null,
      space: vramTotal > 0 ? { kind: 'vram', used: vramUsed, total: vramTotal } : null,
      work: null,
      onChain: false,
      facts: [
        ['Node', n.id],
        ['Reported by', 'the resource manager'],
        ...(im?.gpus ?? []).map(
          (g, i) =>
            [`GPU ${i + 1} utilisation`, g.utilization != null ? `${Math.round(g.utilization * 100)}%` : '—'] as [
              string,
              string,
            ],
        ),
      ],
    });
  }
  const agentMetrics = new Map((fleet?.agents ?? []).map((a) => [a.pod, a]));
  for (const n of registry.filter((x) => !x.sandbox && !x.inference && x.agent)) {
    const pod = n.id.split('.')[0];
    const am = agentMetrics.get(pod);
    rows.push({
      key: `a:${n.id}`,
      name: pod,
      detail: 'agent runtime pod',
      runs: `Agent runtime${am?.slots_total ? ` · ${am.slots_used ?? 0} of ${am.slots_total} slots busy` : ''}`,
      status: n.healthy ? (am ? statusOf(am.up, am.last_seen, now) : 'up') : 'down',
      lastSeen: n.last_seen,
      availability: null,
      uptimeS: null,
      version: am?.version ?? null,
      cpuCores: null,
      cpuUsed: null,
      memTotal: null,
      memUsed: null,
      space: null,
      work: null,
      onChain: false,
      facts: [
        ['Node', n.id],
        ['Runs, 24 h', am?.runs_24h != null ? `${am.runs_24h}` : '—'],
      ],
    });
  }
  return rows;
}

/** "7 d 18 h", "5 h 3 min", "12 min". */
export function uptime(s: number | null | undefined): string {
  if (s == null) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}
