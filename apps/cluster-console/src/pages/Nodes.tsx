import { useMemo } from 'react';
import { Box, Stack, Typography } from '@cluster-apps/ui';

import type { FleetView } from '~/api/metricsTypes';
import type { ChainSnapshot, DACView, NodesView } from '~/api/types';
import {
  color,
  CouldNotRead,
  Facts,
  Loading,
  Meter,
  Mono,
  NotYet,
  PageHeader,
  Panel,
  RowsTable,
  Status,
  text,
} from '~/components/ui';
import { ago, bytes, compact, num, percent } from '~/format';
import { useView } from '~/hooks/useView';

import { fleetRows, uptime, type FleetRow } from './fleetRows';
import { nodeCounts, nodeLine } from './nodeModel';

const STATUS: Record<FleetRow['status'], [string, 'success' | 'danger' | 'warning' | 'neutral']> = {
  up: ['Up', 'success'],
  down: ['Down', 'danger'],
  silent: ['Silent', 'warning'],
  unknown: ['No reading', 'neutral'],
};

function workLine(w: FleetRow['work']): string {
  if (!w) return '—';
  const parts: string[] = [];
  if (w.transferred_bytes) parts.push(`${bytes(w.transferred_bytes)} delivered`);
  if (w.cpu_units) parts.push(`${compact(w.cpu_units)} CPU units`);
  if (w.gpu_units) parts.push(`${compact(w.gpu_units)} GPU units`);
  return parts.join(' · ') || 'none';
}

function Used({
  used,
  total,
  format,
  plain,
}: {
  used: number | null;
  total: number | null;
  format: (v: number) => string;
  plain?: boolean;
}) {
  if (total == null) return <span style={{ color: color.textTertiary }}>—</span>;
  return (
    <Stack spacing={0.5} sx={{ minWidth: 110 }}>
      <Typography sx={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
        {used != null ? format(used) : '—'} of {format(total)}
      </Typography>
      {used != null && <Meter value={used} max={total} label={`${format(used)} of ${format(total)}`} plain={plain} />}
    </Stack>
  );
}

/**
 * Nodes (canvas c1): every node the cluster runs in one list with the same
 * columns, whatever it does. Each service page has its own view per node.
 */
export function Nodes() {
  const fleet = useView<FleetView>('/fleet', undefined, 30_000);
  const nodes = useView<NodesView>('/nodes', undefined, 30_000);
  const chain = useView<ChainSnapshot>('/chain', undefined, 60_000);
  const dac = useView<DACView>('/dac', { hours: 24 }, 60_000);
  const rows = useMemo(
    () => fleetRows(fleet.data, nodes.data, chain.data, dac.data),
    [fleet.data, nodes.data, chain.data, dac.data],
  );
  const counts = chain.data ? nodeCounts(chain.data.nodes) : null;
  const down = rows.filter((r) => r.status === 'down' || r.status === 'silent').length;
  const groupWork = (keys: string[]) => {
    const t = keys.reduce(
      (a, k) => {
        const u = dac.data?.nodes[k.toLowerCase()];
        return u ? { cpu: a.cpu + u.cpu_units, gpu: a.gpu + u.gpu_units } : a;
      },
      { cpu: 0, gpu: 0 },
    );
    return t.cpu || t.gpu
      ? `verified in 24 h: ${[t.cpu ? `${compact(t.cpu)} CPU units` : '', t.gpu ? `${compact(t.gpu)} GPU units` : ''].filter(Boolean).join(', ')}`
      : 'no verified work in 24 h';
  };
  const loading = !fleet.data && !nodes.data && !fleet.error && !nodes.error;

  return (
    <>
      <PageHeader
        title="Nodes"
        subtitle={counts ? nodeLine(counts) : 'Every node the cluster runs, with the same figures for each.'}
        updatedAt={fleet.updatedAt}
        onRefresh={() => [fleet, nodes, chain, dac].forEach((v) => v.refresh())}
        refreshing={fleet.loading}
      />
      {loading && <Loading />}
      {!loading && (
        <Stack spacing={2}>
          {fleet.error && <CouldNotRead error={fleet.error} what="node metrics" />}
          {nodes.error && <CouldNotRead error={nodes.error} what="the resource manager’s nodes" />}
          {fleet.data?.missing
            .slice(0, 2)
            .map((m) => <CouldNotRead key={m.source} error={m} what="some node figures" />)}
          <Typography sx={text.secondary}>
            {rows.length} nodes · {down === 0 ? 'all up' : `${down} down or silent`}
          </Typography>
          <Panel flush>
            <RowsTable
              rows={rows}
              rowKey={(r) => r.key}
              empty="No node reports."
              columns={[
                {
                  label: 'Node',
                  render: (r) => (
                    <Stack>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.name}</Typography>
                      {r.detail && <Typography sx={{ ...text.caption }}>{r.detail}</Typography>}
                    </Stack>
                  ),
                },
                { label: 'Runs', render: (r) => r.runs },
                {
                  label: 'Status',
                  render: (r) => (
                    <Stack spacing={0.25}>
                      <Status tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Status>
                      {r.status === 'silent' && r.lastSeen && (
                        <Typography sx={text.caption}>last {ago(r.lastSeen)}</Typography>
                      )}
                    </Stack>
                  ),
                },
                {
                  label: 'Up, 7 days',
                  align: 'right',
                  render: (r) => (r.availability != null ? `${num(r.availability * 100, 2)}%` : '—'),
                },
                {
                  label: 'Uptime',
                  align: 'right',
                  render: (r) => <span style={{ whiteSpace: 'nowrap' }}>{uptime(r.uptimeS)}</span>,
                },
                { label: 'Version', render: (r) => (r.version ? <Mono>{r.version}</Mono> : '—') },
                {
                  label: 'CPU',
                  render: (r) =>
                    r.cpuCores != null ? (
                      <Stack spacing={0.5} sx={{ minWidth: 90 }}>
                        <Typography sx={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                          {r.cpuUsed != null ? percent(r.cpuUsed, 1) : '—'} of {r.cpuCores} cores
                        </Typography>
                        {r.cpuUsed != null && (
                          <Meter value={r.cpuUsed} max={1} label={`CPU busy ${percent(r.cpuUsed, 1)}`} />
                        )}
                      </Stack>
                    ) : (
                      <span style={{ color: color.textTertiary }}>—</span>
                    ),
                },
                {
                  label: 'Memory',
                  render: (r) => <Used used={r.memUsed} total={r.memTotal} format={(v) => bytes(v)} />,
                },
                {
                  label: 'Disk or GPU memory',
                  render: (r) =>
                    r.space ? (
                      <Used
                        used={r.space.used}
                        total={r.space.total}
                        format={(v) => bytes(v)}
                        plain={r.space.kind === 'vram'}
                      />
                    ) : (
                      <span style={{ color: color.textTertiary }}>—</span>
                    ),
                },
                {
                  label: 'Work verified, 24 h',
                  render: (r) => (
                    <Typography sx={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{workLine(r.work)}</Typography>
                  ),
                },
              ]}
              detail={(r) => <Facts items={r.facts.map(([k, v]) => [k, <Mono key={k}>{v}</Mono>])} />}
            />
          </Panel>
          {counts && counts.compute > 0 && (
            <Box>
              <Typography sx={{ ...text.secondary }}>
                Also on chain: {counts.compute} compute identities, keys that compute services sign their work with —{' '}
                {counts.groups.map((g, i) => (
                  <span key={g.role}>
                    {i > 0 ? '; ' : ''}
                    <b style={{ color: color.text }}>
                      {g.keys.length} {g.role}
                    </b>{' '}
                    ({g.hosts.length === 1 ? g.hosts[0] : `${g.hosts.length} hosts`}, {groupWork(g.keys)})
                  </span>
                ))}
                .
              </Typography>
            </Box>
          )}
          <NotYet why="The resource manager keeps only each node's last report, and metrics are kept 30 days; in-cluster-since and stake need a blockchain history read.">
            region, in cluster since, stake, and reporting history over 30 days.
          </NotYet>
        </Stack>
      )}
    </>
  );
}
