import { useMemo, useRef } from 'react';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';

import type { FleetView, Machine, StorageView } from '~/api/metricsTypes';
import { QuotaBar, SERIES, TimeChart } from '~/components/charts';
import { useFilters } from '~/components/Filters';
import {
  CouldNotRead,
  Facts,
  Figure,
  Figures,
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
import { ago, bytes, num, percent, plural } from '~/format';
import { useView } from '~/hooks/useView';

import {
  aboutDuration,
  byFullest,
  change,
  diskTotals,
  fullAtThisRate,
  isStorageMode,
  lastKnown,
  missingLine,
  NEARLY_FULL,
  sumKnown,
  type DiskTotals,
  type FullIn,
} from './serviceMath';

const NO_QUOTA = 'The resource manager does not reserve a per-service quota yet.';
const DEFAULT_DAYS = 30;
const NEARLY_FULL_PCT = `${Math.round(NEARLY_FULL * 100)}%`;

/**
 * Storage (mockup s1): disk per storage node, and when the cluster fills at
 * the rate it grows. Storage nodes are those the blockchain lists as storage
 * or full; cache nodes hold no customer data.
 */
export function Storage() {
  const f = useFilters(['days']);
  const days = f.values.days === '7' ? 7 : DEFAULT_DAYS;
  const sv = useView<StorageView>('/storage', { days }, 300_000);
  const fv = useView<FleetView>('/fleet', undefined, 60_000);
  const storage = useHeld(sv.data);
  const fleet = fv.data;
  const nodes = useMemo(() => byFullest((fleet?.machines ?? []).filter((m) => isStorageMode(m.mode))), [fleet]);
  const disk = diskTotals(nodes);
  const series = storage?.series ?? [];
  const n = storage?.days ?? days;
  const stale = sv.loading && storage !== sv.data;
  const missing = missingLine([storage?.missing, fleet?.missing]);
  const settled = (storage || sv.error) && (fleet || fv.error);

  return (
    <>
      <PageHeader
        title="Storage"
        subtitle="Disk on each storage node, and when the cluster fills at the rate it grows."
        updatedAt={sv.updatedAt ?? fv.updatedAt}
        onRefresh={() => [sv, fv].forEach((x) => x.refresh())}
        refreshing={sv.loading || fv.loading}
        actions={
          <PeriodToggle
            days={days}
            options={[7, 30]}
            onChange={(d) => f.set('days', d === DEFAULT_DAYS ? '' : `${d}`)}
          />
        }
      />
      {!settled && <Loading />}
      {settled && (
        <Stack spacing={2} sx={{ opacity: stale ? 0.6 : 1 }}>
          {sv.error && !storage && <CouldNotRead error={sv.error} what="disk history" />}
          {fv.error && !fleet && <CouldNotRead error={fv.error} what="the storage nodes" />}
          {missing && <CouldNotRead error={missing} what="some storage readings" />}

          <Figures columns={4}>
            <DiskFigure disk={disk} read={!!fleet} />
            <Figure
              label="Stored by customers"
              value={fleet ? bytes(sumKnown(nodes.map((m) => m.stored_bytes))) : '—'}
              sub={growthLine(
                change(series, (p) => p.stored_bytes),
                n,
              )}
            />
            <Figure
              label="Storage nodes"
              value={fleet ? num(nodes.length, 0) : '—'}
              sub={fleet && nodes.length > 0 ? <NodeStates disk={disk} /> : undefined}
            />
            <FullFigure full={storage ? fullAtThisRate(series) : null} days={n} />
          </Figures>

          <Panel title={`Disk used, last ${n} days`} subtitle={chartSubtitle(lastKnown(series, (p) => p.total_bytes))}>
            {storage ? (
              <TimeChart
                starts={series.map((p) => Date.parse(p.t))}
                stepMs={(storage.step_s || 86_400) * 1000}
                series={[
                  {
                    key: 'used',
                    label: 'Disk used',
                    color: SERIES.billed,
                    values: series.map((p) => p.used_bytes),
                    total: bytes(lastKnown(series, (p) => p.used_bytes)),
                  },
                  {
                    key: 'stored',
                    label: 'Stored by customers',
                    color: SERIES.measured,
                    values: series.map((p) => p.stored_bytes),
                    total: bytes(lastKnown(series, (p) => p.stored_bytes)),
                  },
                ]}
                format={(v) => bytes(v)}
                axis={(v) => bytes(v).replace(' ', '')}
                label={`Disk used and data stored on the storage nodes, each day of the last ${n} days`}
                height={220}
                tableLabel="Day"
              />
            ) : (
              <Typography sx={text.secondary}>No disk history to show.</Typography>
            )}
          </Panel>

          <Panel
            flush
            title="Storage nodes"
            subtitle="Fullest first. A machine can also run sandboxes and inference; the bar is storage’s use of the machine’s disk."
          >
            <RowsTable
              rows={nodes}
              rowKey={(m) => m.key || m.instance}
              empty={fleet ? 'The metrics list no storage node.' : 'The storage nodes could not be read.'}
              columns={[
                { label: 'Node', render: (m) => <NodeName host={m.host} instance={m.instance} /> },
                {
                  label: 'Disk',
                  width: 320,
                  render: (m) => (
                    <QuotaBar
                      total={m.disk_total_bytes}
                      quota={null}
                      used={m.disk_used_bytes}
                      format={bytes}
                      quotaMissing={NO_QUOTA}
                    />
                  ),
                },
                { label: 'Stored', align: 'right', render: (m) => bytes(m.stored_bytes) },
                { label: 'Served 24 h', align: 'right', render: (m) => bytes(m.served_24h_bytes) },
                { label: 'Uptime', align: 'right', render: (m) => uptime(m.uptime_s) },
                { label: 'Status', render: (m) => <UpStatus up={m.up} /> },
              ]}
              detail={(m) => <NodeFacts m={m} />}
            />
          </Panel>

          <NotYet why="Storage nodes don’t report the disk level at which they stop taking writes.">
            where each node stops taking writes. This page counts a node above {NEARLY_FULL_PCT} of its disk as nearly
            full.
          </NotYet>
        </Stack>
      )}
    </>
  );
}

function DiskFigure({ disk, read }: { disk: DiskTotals; read: boolean }) {
  const known = disk.used !== null && disk.total !== null;
  const silent = disk.nodes - disk.reporting;
  return (
    <Figure
      label="Disk used, storage nodes"
      value={known ? percent(disk.used, disk.total) : '—'}
      sub={
        known
          ? `${bytes(disk.used)} of ${bytes(disk.total)}${silent ? ` · ${plural(silent, 'node')} not reporting` : ''}`
          : read && disk.nodes > 0
            ? 'No storage node reports its disk.'
            : undefined
      }
    >
      {known && <Meter value={disk.used as number} max={disk.total as number} label="Disk used on storage nodes" />}
    </Figure>
  );
}

function NodeStates({ disk }: { disk: DiskTotals }) {
  return (
    <Stack spacing={0.5}>
      {disk.nearlyFull > 0 ? (
        <Status tone="warning">
          {num(disk.nearlyFull, 0)} above {NEARLY_FULL_PCT} of disk
        </Status>
      ) : (
        <span>None above {NEARLY_FULL_PCT} of disk</span>
      )}
      {disk.down > 0 && <Status tone="danger">{num(disk.down, 0)} down</Status>}
    </Stack>
  );
}

function FullFigure({ full, days }: { full: FullIn | null; days: number }) {
  if (!full) return <Figure label="Full at this rate" value="—" />;
  if (full.kind === 'flat')
    return <Figure label="Full at this rate" value="Not growing" sub={`in the last ${days} days`} />;
  if (full.kind === 'unknown') return <Figure label="Full at this rate" value="—" sub={full.why} />;
  return (
    <Figure
      label="Full at this rate"
      value={aboutDuration(full.days)}
      sub={`Growing ${bytes(full.perDay)} a day · ${bytes(full.free)} free`}
    />
  );
}

function NodeFacts({ m }: { m: Machine }) {
  return (
    <Facts
      items={[
        ['Node key', m.key ? <Mono key="k">{m.key}</Mono> : '—'],
        ['Role', m.mode === 'full' ? 'Stores and serves data (full node)' : 'Stores data'],
        ['On the blockchain', m.on_chain ? 'Yes' : 'No: not in the cluster’s node list'],
        ['Version', m.version ?? '—'],
        ['Last reading', ago(m.last_seen)],
        ['Last 7 days', downtime(m.availability_7d)],
        ['Requests now', m.requests_per_s !== null ? `${num(m.requests_per_s)} a second` : '—'],
      ]}
    />
  );
}

const chartSubtitle = (total: number | null) =>
  `Storage nodes, one point a day; the legend shows the latest day. ${
    total !== null ? `Their disks hold ${bytes(total)} in all.` : 'Their disk total is not reported.'
  }`;

const growthLine = (delta: number | null, days: number) =>
  delta === null ? undefined : `${delta >= 0 ? '+' : '−'}${bytes(Math.abs(delta))} in the last ${days} days`;

/** Seconds since start as `7 d 18 h`, `5 h 12 min`, `40 min`. */
function uptime(s: number | null): string {
  if (s === null) return '—';
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d >= 1) return `${d} d ${h} h`;
  if (h >= 1) return `${h} h ${m} min`;
  return `${m} min`;
}

/** Share of 7 days up as time down, which a whole percent would round away. */
function downtime(availability: number | null): string {
  if (availability === null) return '—';
  const down = (1 - availability) * 7 * 86_400;
  if (down < 30) return 'Up the whole time';
  if (down < 3600) return `Down about ${Math.round(down / 60)} min`;
  return `Down about ${num(down / 3600)} h`;
}

function NodeName({ host, instance }: { host: string; instance: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{host || instance || '—'}</Typography>
      {host && instance && <Typography sx={text.caption}>{instance}</Typography>}
    </Box>
  );
}

function UpStatus({ up }: { up: boolean | null }) {
  if (up === null) return <Status tone="neutral">No reading</Status>;
  return up ? <Status tone="success">Up</Status> : <Status tone="danger">Down</Status>;
}

function PeriodToggle({
  days,
  options,
  onChange,
}: {
  days: number;
  options: number[];
  onChange: (days: number) => void;
}) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={`${days}`}
      onChange={(_, v: string | null) => v && onChange(Number(v))}
      aria-label="Period"
    >
      {options.map((d) => (
        <ToggleButton key={d} value={`${d}`}>
          {d} days
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/** The last data a view returned, kept on screen while another period is read. */
function useHeld<T>(data: T | null): T | null {
  const last = useRef<T | null>(null);
  if (data) last.current = data;
  return data ?? last.current;
}
