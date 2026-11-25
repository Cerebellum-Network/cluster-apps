import { useSearchParams } from 'react-router-dom';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';

import type { SandboxMetrics } from '~/api/metricsTypes';
import type { NodesView, Sandbox } from '~/api/types';
import { SERIES, TimeChart } from '~/components/charts';
import {
  color,
  CouldNotRead,
  Disclosure,
  DrawerBlock,
  Facts,
  Loading,
  Mono,
  NotYet,
  Pill,
  SideDrawer,
  text,
  type Tone,
} from '~/components/ui';
import { bytes, gibTime, mib, num, seconds, shortKey, shortTime, timeColumn, vcpuTime } from '~/format';
import { useView } from '~/hooks/useView';

import { billedOf, billingBasisWords, type BilledSplit, exitReasonWords, limitsOf, resourceUse } from './limits';
import { BURST, Key, RequestGauge } from './LiveNodes';
import { placementSummary, verdict } from './placement';

export const STATUS_TONE: Record<string, Tone> = {
  running: 'success',
  starting: 'primary',
  terminated: 'neutral',
  failed: 'danger',
  unknown: 'warning',
};

const STATUS_WORD: Record<string, string> = {
  running: 'Running',
  starting: 'Starting',
  terminated: 'Ended',
  failed: 'Failed',
  unknown: 'Unknown',
};

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={STATUS_TONE[status] ?? 'neutral'}>{STATUS_WORD[status] ?? status}</Pill>;
}

/** Node id → a readable name (its host), from the nodes view. */
export function useNodeNames(): (id: string | null | undefined) => string {
  const v = useView<NodesView>('/nodes', undefined, 60_000);
  const names = new Map<string, string>();
  for (const n of v.data?.items ?? []) {
    let host = n.chain?.host || n.host;
    const ep = n.sandbox?.endpoint;
    if (ep) {
      try {
        host = new URL(ep).hostname;
      } catch {
        // keep the registry host
      }
    }
    names.set(n.id, host.replace(/:\d+$/, ''));
  }
  return (id) => (id ? (names.get(id) ?? shortKey(id)) : '—');
}

/** The sandbox a page shows in its drawer: `?sandbox=<id>`, so a link opens it. */
export function useOpenSandbox(): [string | null, (id: string | null) => void] {
  const [sp, setSp] = useSearchParams();
  const id = sp.get('sandbox');
  const set = (next: string | null) => {
    const q = new URLSearchParams(sp);
    if (next) q.set('sandbox', next);
    else q.delete('sandbox');
    setSp(q, { replace: false });
  };
  return [id, set];
}

const points = (p: { t: string; v: number | null }[]) => ({
  starts: p.map((x) => Date.parse(x.t)),
  values: p.map((x) => x.v),
});

const lastValue = (p: { v: number | null }[] | undefined) => {
  for (let i = (p?.length ?? 0) - 1; i >= 0; i--) if (p![i].v != null) return p![i].v;
  return null;
};

/** Billed for one resource, as one bar split into the request and the burst above it. */
function SplitBar({ split, format, what }: { split: BilledSplit; format: (v: number) => string; what: string }) {
  const total = split.billed || 1;
  return (
    <Box
      role="img"
      aria-label={`${what} billed ${format(split.billed)}: ${format(split.floor)} for the request, ${format(split.burst)} for burst`}
      sx={{
        display: 'flex',
        height: 8,
        gap: '2px',
        borderRadius: '4px',
        overflow: 'hidden',
        backgroundColor: color.grid,
      }}
    >
      {split.floor > 0 && <Box sx={{ width: `${(100 * split.floor) / total}%`, backgroundColor: SERIES.billed }} />}
      {split.burst > 0 && (
        <Box sx={{ width: `${(100 * split.burst) / total}%`, minWidth: 2, backgroundColor: BURST }} />
      )}
    </Box>
  );
}

/** One sandbox: what it is, its use over time, billed against measured, where it runs and why, its rules. */
export function SandboxDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <SideDrawer open={!!id} onClose={onClose} title={id ?? ''} subtitle={id ? <DrawerSubtitle id={id} /> : undefined}>
      {id && <DrawerBody id={id} />}
    </SideDrawer>
  );
}

function DrawerSubtitle({ id }: { id: string }) {
  const v = useView<Sandbox>(`/sandboxes/${id}`, undefined, 5_000);
  if (!v.data) return null;
  return (
    <Stack direction="row" spacing={1} alignItems="center" component="span">
      <StatusPill status={v.data.status} />
      <span>
        Bucket {v.data.bucket} · {v.data.image}
      </span>
    </Stack>
  );
}

function DrawerBody({ id }: { id: string }) {
  const name = useNodeNames();
  const v = useView<Sandbox>(`/sandboxes/${id}`, undefined, 5_000);
  const live = v.data?.status === 'running' || v.data?.status === 'starting';
  const m = useView<SandboxMetrics>(`/sandboxes/${id}/metrics`, { minutes: 60 }, live ? 15_000 : 0);
  if (v.error && !v.data) return <CouldNotRead error={v.error} what="this sandbox" />;
  if (!v.data) return <Loading />;
  const s = v.data;
  const u = s.usage;
  const where = placementSummary(s.placement, s.resources, s.node, (n) => name(n));
  const cpuPts = m.data ? points(m.data.cpu) : null;
  const memPts = m.data ? points(m.data.memory_bytes) : null;
  const l = limitsOf(s.resources);
  const cpuNow = live ? lastValue(m.data?.cpu) : null;
  const memNow = live ? lastValue(m.data?.memory_bytes) : null;
  const now = {
    resources: s.resources,
    live:
      cpuNow != null && memNow != null
        ? {
            cpu: cpuNow,
            memory_mib: memNow / 2 ** 20,
            memory_peak_mib: 0,
            period_start: '',
            period_end: '',
            source: 'node metrics',
          }
        : null,
  };
  const billed = billedOf(u);
  const basis = billingBasisWords(u?.billing_basis);
  const measuredOnly = u?.billing_basis === 'measured';
  // One unit per column, from its largest amount.
  const cpuCol = timeColumn(Math.max(billed.cpu?.billed ?? 0, u?.cpu_s ?? 0), 'vCPU');
  const ramCol = timeColumn(Math.max(billed.memory?.billed ?? 0, u?.ram_gib_s ?? 0), 'GiB');
  const ended = exitReasonWords(s.exit_reason);
  return (
    <Stack spacing={3}>
      <DrawerBlock title={live ? 'Request and limit, now' : 'Request and limit'}>
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ ...text.caption, fontWeight: 600 }}>vCPU</Typography>
            <RequestGauge
              u={resourceUse(now, 'cpu')}
              scale={l.cpuLimit}
              fill={SERIES.one}
              format={(x) => num(x, 2)}
              unit="vCPU"
              what="vCPU"
              noReading={live ? 'no reading yet' : 'not running'}
            />
          </Box>
          <Box>
            <Typography sx={{ ...text.caption, fontWeight: 600 }}>Memory</Typography>
            <RequestGauge
              u={resourceUse(now, 'memory')}
              scale={l.memoryLimitMiB}
              fill={SERIES.measured}
              format={mib}
              what="memory"
              noReading={live ? 'no reading yet' : 'not running'}
            />
          </Box>
          <Typography sx={text.caption}>
            The request is what the node keeps for it and what it pays for at least; the limit is the most it can use.
            {l.cpuLimit > l.cpu || l.memoryLimitMiB > l.memoryMiB
              ? ' Use above the request is billed as used.'
              : ' This sandbox is limited at its request.'}
          </Typography>
        </Stack>
      </DrawerBlock>

      <DrawerBlock title="Use, last hour">
        {m.error && <CouldNotRead error={m.error} what="its use over time" />}
        {m.data && cpuPts && cpuPts.starts.length > 0 ? (
          <Stack spacing={2}>
            <TimeChart
              starts={cpuPts.starts}
              stepMs={m.data.step_s * 1000}
              series={[
                {
                  key: 'cpu',
                  label: 'vCPU used',
                  color: SERIES.one,
                  values: cpuPts.values,
                  total: '',
                },
              ]}
              levels={[
                { key: 'req', label: 'Request', value: l.cpu, display: num(l.cpu, 2), kind: 'floor' },
                ...(l.cpuLimit > l.cpu
                  ? [
                      {
                        key: 'lim',
                        label: 'Limit',
                        value: l.cpuLimit,
                        display: num(l.cpuLimit, 2),
                        kind: 'ceiling' as const,
                      },
                    ]
                  : []),
              ]}
              format={(x) => `${num(x, 3)} vCPU`}
              axis={(x) => num(x, 2)}
              label="vCPU used over the last hour"
              height={110}
              tableLabel="Time"
            />
            {memPts && (
              <TimeChart
                starts={memPts.starts}
                stepMs={m.data.step_s * 1000}
                series={[
                  {
                    key: 'mem',
                    label: 'Memory used',
                    color: SERIES.measured,
                    values: memPts.values.map((v) => (v == null ? null : v / 2 ** 20)),
                    total: '',
                  },
                ]}
                levels={[
                  {
                    key: 'req',
                    label: 'Request',
                    value: l.memoryMiB,
                    display: mib(l.memoryMiB),
                    kind: 'floor',
                  },
                  ...(l.memoryLimitMiB > l.memoryMiB
                    ? [
                        {
                          key: 'lim',
                          label: 'Limit',
                          value: l.memoryLimitMiB,
                          display: mib(l.memoryLimitMiB),
                          kind: 'ceiling' as const,
                        },
                      ]
                    : []),
                ]}
                format={(x) => mib(x)}
                axis={(x) => mib(x).replace(' ', '')}
                axisWidth={58}
                label="Memory used over the last hour"
                height={110}
                tableLabel="Time"
              />
            )}
          </Stack>
        ) : (
          !m.error && m.data && <Typography sx={text.secondary}>No samples in the last hour.</Typography>
        )}
        {!m.data && !m.error && <Loading />}
      </DrawerBlock>

      <DrawerBlock title="Billed">
        {u ? (
          <Stack spacing={1.5}>
            {basis && <Typography sx={{ fontSize: 13.5 }}>{basis}.</Typography>}
            <Table
              size="small"
              sx={{ '& td, & th': { fontSize: 13, padding: '6px 8px', fontVariantNumeric: 'tabular-nums' } }}
            >
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell align="right">vCPU</TableCell>
                  <TableCell align="right">Memory</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!measuredOnly && (
                  <>
                    <TableRow>
                      <TableCell>
                        <Key fill={SERIES.billed} />
                        For the request
                      </TableCell>
                      <TableCell align="right">{billed.cpu ? cpuCol(billed.cpu.floor) : '—'}</TableCell>
                      <TableCell align="right">{billed.memory ? ramCol(billed.memory.floor) : '—'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Key fill={BURST} />
                        Burst, above the request
                      </TableCell>
                      <TableCell align="right">{billed.cpu ? cpuCol(billed.cpu.burst) : '—'}</TableCell>
                      <TableCell align="right">{billed.memory ? ramCol(billed.memory.burst) : '—'}</TableCell>
                    </TableRow>
                  </>
                )}
                <TableRow sx={{ '& td': { fontWeight: 600 } }}>
                  <TableCell>Billed</TableCell>
                  <TableCell align="right">{billed.cpu ? cpuCol(billed.cpu.billed) : '—'}</TableCell>
                  <TableCell align="right">{billed.memory ? ramCol(billed.memory.billed) : '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Measured use</TableCell>
                  <TableCell align="right">{cpuCol(u.cpu_s)}</TableCell>
                  <TableCell align="right">{ramCol(u.ram_gib_s)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            {!measuredOnly && (billed.cpu || billed.memory) && (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px', alignItems: 'center' }}>
                {billed.cpu && (
                  <>
                    <Typography sx={text.caption}>vCPU</Typography>
                    <SplitBar split={billed.cpu} format={vcpuTime} what="vCPU" />
                  </>
                )}
                {billed.memory && (
                  <>
                    <Typography sx={text.caption}>Memory</Typography>
                    <SplitBar split={billed.memory} format={gibTime} what="Memory" />
                  </>
                )}
              </Box>
            )}
          </Stack>
        ) : (
          <Typography sx={text.secondary}>No usage reported yet.</Typography>
        )}
        {u && u.billed_cpu_s == null && <NotYet>billed figures: this runtime reports measured use only.</NotYet>}
      </DrawerBlock>

      <DrawerBlock title="Where it runs">
        <Typography sx={{ fontSize: 13.5 }}>{where.sentence}</Typography>
        {where.refused.length > 0 && (
          <Stack spacing={0.5} sx={{ marginTop: 1 }}>
            {where.refused.map((r) => (
              <Typography key={r.why} sx={{ ...text.secondary }}>
                {r.nodes.length === 1 ? r.nodes[0] : `${r.nodes.length} nodes`} didn’t fit: {r.why}.
              </Typography>
            ))}
          </Stack>
        )}
        {where.retried.map((r) => (
          <Typography key={r.node} sx={{ ...text.secondary, marginTop: 0.5 }}>
            Tried {r.node} first: {r.detail}.
          </Typography>
        ))}
        {s.placement && s.placement.candidates?.length > 0 && (
          <Box sx={{ marginTop: 1 }}>
            <Disclosure label="Show the placement record">
              <Table
                size="small"
                sx={{ '& td, & th': { fontSize: 12.5, padding: '4px 8px', fontVariantNumeric: 'tabular-nums' } }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Node</TableCell>
                    <TableCell align="right">Free vCPU</TableCell>
                    <TableCell align="right">Free memory</TableCell>
                    <TableCell>Fit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...s.placement.candidates]
                    .sort((a, b) => b.score - a.score)
                    .map((c) => {
                      const vd = verdict(c, s.resources);
                      return (
                        <TableRow
                          key={c.node}
                          sx={c.node === where.node ? { backgroundColor: color.successTint } : undefined}
                        >
                          <TableCell>{name(c.node)}</TableCell>
                          <TableCell align="right">{num(c.free_cpu, 2)}</TableCell>
                          <TableCell align="right">{mib(c.free_memory_mib)}</TableCell>
                          <TableCell>{vd.fits ? (c.node === where.node ? 'placed here' : 'fits') : vd.why}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
              <Typography sx={{ ...text.caption, marginTop: 1 }}>
                The resource manager puts a sandbox on the node with the most free memory after placement, among the
                nodes with room. Decided {shortTime(s.placement.decided_at)}.
              </Typography>
            </Disclosure>
          </Box>
        )}
      </DrawerBlock>

      <DrawerBlock title="What it is">
        <Facts
          items={[
            ['Customer', `Bucket ${s.bucket}`],
            ['Image', <Mono key="i">{s.image}</Mono>],
            ['Command', s.command?.length ? <Mono key="c">{s.command.join(' ')}</Mono> : '—'],
            ['Request', `${num(l.cpu, 2)} vCPU · ${mib(l.memoryMiB)}`],
            [
              'Limit',
              l.cpuLimit > l.cpu || l.memoryLimitMiB > l.memoryMiB
                ? `${num(l.cpuLimit, 2)} vCPU · ${mib(l.memoryLimitMiB)}`
                : 'the request',
            ],
            [
              'Started',
              `${shortTime(s.started_at ?? s.created_at)}${s.startup_ms != null ? ` · up in ${num(s.startup_ms, 0)} ms` : ''}`,
            ],
            ['Ran', u ? seconds(u.wall_s) : '—'],
            [
              'Ended',
              s.ended_at ? (
                <span key="e" title={s.exit_reason ?? undefined}>
                  {shortTime(s.ended_at)}
                  {ended ? ` · ${ended}` : ''}
                  {s.exit_code != null && !/code/.test(ended ?? '') ? ` (code ${s.exit_code})` : ''}
                </span>
              ) : (
                '—'
              ),
            ],
            ['Time limit', `${seconds(s.timeout_s)}${s.idle_timeout_s ? ` · idle ${seconds(s.idle_timeout_s)}` : ''}`],
            ['Peak memory', u ? mib(u.memory_peak_mib) : '—'],
            ...(u?.cpu_peak ? ([['Peak vCPU', num(u.cpu_peak, 2)]] as [string, string][]) : []),
            ['Network out · in', u ? `${bytes(u.net_egress_bytes)} · ${bytes(u.net_ingress_bytes)}` : '—'],
          ]}
        />
      </DrawerBlock>

      <DrawerBlock title="May reach">
        {s.egress?.allow?.length ? (
          <Stack spacing={0.5}>
            {s.egress.allow.map((r, i) => (
              <Typography key={i} sx={{ fontSize: 13 }}>
                <Mono>
                  {r.methods?.join(', ') || 'any method'} {r.host}
                  {r.path_prefix ?? ''}
                </Mono>
                {r.credential && (
                  <>
                    {' '}
                    with credential <b>{r.credential}</b>
                  </>
                )}
              </Typography>
            ))}
          </Stack>
        ) : (
          <Typography sx={text.secondary}>No host outside.</Typography>
        )}
      </DrawerBlock>

      <Disclosure label="Identifiers">
        <Facts
          items={[
            ['Sandbox', <Mono key="s">{s.id}</Mono>],
            ['Node', <Mono key="n">{s.node ?? '—'}</Mono>],
            ['Owner account', s.owner ? <Mono key="o">{s.owner}</Mono> : '—'],
            [
              'Labels',
              s.labels && Object.keys(s.labels).length
                ? Object.entries(s.labels)
                    .map(([k, val]) => `${k}=${val}`)
                    .join(', ')
                : 'none',
            ],
          ]}
        />
      </Disclosure>
    </Stack>
  );
}
