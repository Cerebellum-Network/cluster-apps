import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';

import type { NodesView, Placement, Sandbox } from '~/api/types';
import { color, Facts, Mono, Pill, text, type Tone } from '~/components/ui';
import { bytes, chosenNode, cpu, mib, num, seconds, shortKey, time } from '~/format';
import { useView } from '~/hooks/useView';

import { verdict } from './placement';

export const STATUS_TONE: Record<string, Tone> = {
  running: 'success',
  starting: 'primary',
  terminated: 'neutral',
  failed: 'danger',
  unknown: 'warning',
};

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={STATUS_TONE[status] ?? 'neutral'}>{status}</Pill>;
}

/** Node id → a readable name (its host), from the nodes view. */
export function useNodeNames(): (id: string | null | undefined) => string {
  const v = useView<NodesView>('/nodes', undefined, 60_000);
  const names = new Map<string, string>();
  for (const n of v.data?.items ?? []) {
    const ep = n.sandbox?.endpoint;
    let host = n.chain?.host || n.host;
    if (ep) {
      try {
        host = new URL(ep).hostname;
      } catch {
        // keep the registry host
      }
    }
    names.set(n.id, host);
  }
  return (id) => (id ? (names.get(id) ?? shortKey(id)) : '—');
}

export function NodeName({
  id,
  name,
}: {
  id: string | null | undefined;
  name: (id: string | null | undefined) => string;
}) {
  if (!id) return <Typography sx={{ fontSize: 12.5, color: color.textTertiary }}>not placed</Typography>;
  return (
    <Stack>
      <span style={{ whiteSpace: 'nowrap' }}>{name(id)}</span>
      <Mono title={id}>{shortKey(id)}</Mono>
    </Stack>
  );
}

export function PlacementTable({
  p,
  name,
  chosen,
  asked,
}: {
  p: Placement;
  name: (id: string) => string;
  chosen: string | null;
  asked: { cpu: number; memory_mib: number };
}) {
  const attempts = new Map(p.attempts?.map((a) => [a.node, a]) ?? []);
  const ranked = [...(p.candidates ?? [])].sort((a, b) => b.score - a.score);
  return (
    <Table
      size="small"
      sx={{
        backgroundColor: color.surface,
        borderRadius: '8px',
        '& td, & th': { fontSize: 12.5, padding: '5px 10px' },
      }}
    >
      <TableHead>
        <TableRow>
          <TableCell>Candidate node</TableCell>
          <TableCell align="right">Free CPU</TableCell>
          <TableCell align="right">Free memory</TableCell>
          <TableCell align="right" title="Memory left after placement (MiB); -1 when the sandbox does not fit">
            Score
          </TableCell>
          <TableCell>Fits</TableCell>
          <TableCell>Attempt</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {ranked.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} sx={{ color: color.textSecondary }}>
              The resource manager recorded no candidates: no node had room for this sandbox.
            </TableCell>
          </TableRow>
        )}
        {ranked.map((c) => {
          const a = attempts.get(c.node);
          return (
            <TableRow key={c.node} sx={c.node === chosen ? { backgroundColor: color.successTint } : undefined}>
              <TableCell>
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>{name(c.node)}</span>
                  {c.node === chosen && <Pill tone="success">placed here</Pill>}
                </Stack>
              </TableCell>
              <TableCell align="right">{cpu(c.free_cpu)}</TableCell>
              <TableCell align="right">{mib(c.free_memory_mib)}</TableCell>
              <TableCell align="right">{num(c.score, 0)}</TableCell>
              <TableCell>
                <Verdict v={verdict(c, asked)} />
              </TableCell>
              <TableCell>
                {a ? (
                  <span>
                    {a.result}
                    {a.detail ? ` · ${a.detail}` : ''}
                  </span>
                ) : (
                  <span style={{ color: color.textTertiary }}>not tried</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function Verdict({ v }: { v: ReturnType<typeof verdict> }) {
  if (v.fits) return <Pill tone="success">fits</Pill>;
  return (
    <span>
      <Pill tone="warning">does not fit</Pill> {v.why}
      {!v.recorded && v.why.startsWith('not enough') && (
        <span style={{ color: color.textTertiary }}> (from the recorded free room)</span>
      )}
    </span>
  );
}

export function SandboxDetail({ s, name }: { s: Sandbox; name: (id: string | null | undefined) => string }) {
  const chosen = chosenNode(s.placement, s.node);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 3 }}>
      <Stack spacing={1.5}>
        <Facts
          items={[
            ['Sandbox', <Mono key="id">{s.id}</Mono>],
            ['Customer bucket', `${s.bucket}`],
            ['Owner account', s.owner ? <Mono key="o">{s.owner}</Mono> : '—'],
            ['Image', <Mono key="i">{s.image}</Mono>],
            ['Command', s.command?.length ? <Mono key="c">{s.command.join(' ')}</Mono> : '—'],
            [
              'Resources',
              `${cpu(s.resources.cpu)} · ${mib(s.resources.memory_mib)} · pids ${num(s.resources.pids, 0)}`,
            ],
            ['Timeout', `${seconds(s.timeout_s)}${s.idle_timeout_s ? ` · idle ${seconds(s.idle_timeout_s)}` : ''}`],
            ['Created · started · ended', `${time(s.created_at)} · ${time(s.started_at)} · ${time(s.ended_at)}`],
            ['Startup', s.startup_ms != null ? `${num(s.startup_ms, 0)} ms` : '—'],
            ['Exit', s.exit_reason ? `${s.exit_reason}${s.exit_code != null ? ` (code ${s.exit_code})` : ''}` : '—'],
            ['Environment keys', s.env_keys?.length ? s.env_keys.join(', ') : 'none'],
            [
              'Labels',
              s.labels && Object.keys(s.labels).length
                ? Object.entries(s.labels)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ')
                : 'none',
            ],
            ['Retained files', s.retained?.length ? s.retained.join(', ') : 'none'],
          ]}
        />
        {s.usage && (
          <Box>
            <Typography sx={text.label}>Usage</Typography>
            <Typography sx={{ fontSize: 12.5 }}>
              wall {seconds(s.usage.wall_s)} · CPU {num(s.usage.cpu_s, 2)} CPU-s · memory {num(s.usage.ram_gib_s, 2)}{' '}
              GiB-s (peak {mib(s.usage.memory_peak_mib)}) · network out {bytes(s.usage.net_egress_bytes)}, in{' '}
              {bytes(s.usage.net_ingress_bytes)} · disk peak {mib(s.usage.disk_peak_mib)}
            </Typography>
            {s.usage.billing_basis !== undefined && (
              <Typography sx={{ fontSize: 12.5 }}>
                billed {num(s.usage.billed_cpu_s, 2)} CPU-s · {num(s.usage.billed_ram_gib_s, 2)} GiB-s (basis:{' '}
                {s.usage.billing_basis}; reserved {num(s.usage.reserved_cpu_s, 2)} CPU-s ·{' '}
                {num(s.usage.reserved_ram_gib_s, 2)} GiB-s)
              </Typography>
            )}
          </Box>
        )}
      </Stack>
      <Stack spacing={1.5}>
        <Box>
          <Typography sx={text.label}>Egress rules</Typography>
          {s.egress?.allow?.length ? (
            s.egress.allow.map((r, i) => (
              <Typography key={i} sx={{ fontSize: 12.5 }}>
                {r.methods?.join(',') || 'any method'} {r.host}
                {r.path_prefix ?? ''}
                {r.credential ? (
                  <>
                    {' '}
                    · adds credential <b>{r.credential}</b>
                  </>
                ) : null}
              </Typography>
            ))
          ) : (
            <Typography sx={{ fontSize: 12.5, color: color.textSecondary }}>none: no host is reachable</Typography>
          )}
        </Box>
        <Box>
          <Typography sx={text.label}>Placement</Typography>
          {s.placement ? (
            <Stack spacing={0.75}>
              <Typography sx={{ fontSize: 12.5 }}>
                Decided {time(s.placement.decided_at)}; placed on {name(chosen)}. {s.placement.rule ?? ''}
              </Typography>
              <PlacementTable p={s.placement} name={(id) => name(id)} chosen={chosen} asked={s.resources} />
            </Stack>
          ) : (
            <Typography sx={{ fontSize: 12.5, color: color.textSecondary }}>
              The resource manager returned no placement for this sandbox.
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
