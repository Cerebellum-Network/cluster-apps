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
import { bytes, gibTime, mib, num, seconds, shortKey, shortTime, vcpuTime } from '~/format';
import { useView } from '~/hooks/useView';

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
  return (
    <Stack spacing={3}>
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
                  total: `of ${num(s.resources.cpu, 2)} reserved`,
                },
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
                    values: memPts.values,
                    total: `of ${mib(s.resources.memory_mib)} reserved`,
                  },
                ]}
                format={(x) => bytes(x)}
                axis={(x) => bytes(x).replace(' ', '')}
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

      <DrawerBlock title="Billed and measured">
        {u ? (
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
              <TableRow>
                <TableCell>
                  Billed{' '}
                  {u.billing_basis ? `(${u.billing_basis === 'reserved' ? 'on the reservation' : 'on use'})` : ''}
                </TableCell>
                <TableCell align="right">{u.billed_cpu_s != null ? vcpuTime(u.billed_cpu_s) : '—'}</TableCell>
                <TableCell align="right">{u.billed_ram_gib_s != null ? gibTime(u.billed_ram_gib_s) : '—'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Measured</TableCell>
                <TableCell align="right">{vcpuTime(u.cpu_s)}</TableCell>
                <TableCell align="right">{gibTime(u.ram_gib_s)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
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
            ['Size', `${num(s.resources.cpu, 2)} vCPU · ${mib(s.resources.memory_mib)}`],
            [
              'Started',
              `${shortTime(s.started_at ?? s.created_at)}${s.startup_ms != null ? ` · up in ${num(s.startup_ms, 0)} ms` : ''}`,
            ],
            ['Ran', u ? seconds(u.wall_s) : '—'],
            [
              'Ended',
              s.ended_at
                ? `${shortTime(s.ended_at)}${s.exit_reason ? ` · ${s.exit_reason}` : ''}${s.exit_code != null ? ` (code ${s.exit_code})` : ''}`
                : '—',
            ],
            ['Time limit', `${seconds(s.timeout_s)}${s.idle_timeout_s ? ` · idle ${seconds(s.idle_timeout_s)}` : ''}`],
            ['Peak memory', u ? mib(u.memory_peak_mib) : '—'],
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
