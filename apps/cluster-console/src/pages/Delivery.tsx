import { useMemo, useRef } from 'react';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';

import type { DeliveryNode, DeliveryView, FleetView, Machine } from '~/api/metricsTypes';
import { QuotaBar, SERIES, TimeChart } from '~/components/charts';
import { useFilters } from '~/components/Filters';
import {
  CouldNotRead,
  Facts,
  Figure,
  Figures,
  Loading,
  Mono,
  NotYet,
  PageHeader,
  Panel,
  RowsTable,
  Status,
  text,
} from '~/components/ui';
import { bytes, num, percent } from '~/format';
import { useView } from '~/hooks/useView';

import { byFullest, cacheTotals, deliveryOrder, diskShare, missingLine, slowestP95 } from './serviceMath';

const NO_QUOTA = 'The resource manager does not reserve a per-service quota yet.';
const DEFAULT_DAYS = 15;

/**
 * Delivery (mockup s2): bytes served to readers, the share a cache node
 * already held, and each node that served them.
 */
export function Delivery() {
  const f = useFilters(['days']);
  const days = f.values.days === '30' ? 30 : DEFAULT_DAYS;
  const dv = useView<DeliveryView>('/delivery', { days }, 300_000);
  const fv = useView<FleetView>('/fleet', undefined, 60_000);
  const delivery = useHeld(dv.data);
  const fleet = fv.data;
  const n = delivery?.days ?? days;
  const series = delivery?.series ?? [];
  const totals = delivery ? cacheTotals(series) : null;
  const rows = useMemo(() => (delivery ? deliveryOrder(delivery.nodes) : []), [delivery]);
  const machines = useMemo(() => new Map((fleet?.machines ?? []).map((m) => [m.key, m])), [fleet]);
  const caches = (fleet?.machines ?? []).filter((m) => m.mode === 'cache');
  const fullest = byFullest(caches).find((m) => diskShare(m) !== null) ?? null;
  const p95 = delivery ? slowestP95(delivery.nodes) : null;
  const stale = dv.loading && delivery !== dv.data;
  const missing = missingLine([delivery?.missing, fleet?.missing]);
  const settled = (delivery || dv.error) && (fleet || fv.error);

  return (
    <>
      <PageHeader
        title="Delivery"
        subtitle="Bytes served to readers, the share a cache node already held, and each node that served them."
        updatedAt={dv.updatedAt ?? fv.updatedAt}
        onRefresh={() => [dv, fv].forEach((x) => x.refresh())}
        refreshing={dv.loading || fv.loading}
        actions={
          <PeriodToggle
            days={days}
            options={[15, 30]}
            onChange={(d) => f.set('days', d === DEFAULT_DAYS ? '' : `${d}`)}
          />
        }
      />
      {!settled && <Loading />}
      {settled && (
        <Stack spacing={2} sx={{ opacity: stale ? 0.6 : 1 }}>
          {dv.error && !delivery && <CouldNotRead error={dv.error} what="delivery" />}
          {fv.error && !fleet && <CouldNotRead error={fv.error} what="the cache nodes" />}
          {missing && <CouldNotRead error={missing} what="some delivery readings" />}

          <Figures columns={4}>
            <Figure
              label={`Served, ${n} days`}
              value={bytes(totals?.served)}
              sub={totals ? servedLine(totals.served, totals.daysRecorded, series.length) : undefined}
            />
            <Figure
              label="Served from cache"
              value={totals ? percent(totals.cacheShare, 1) : '—'}
              sub={
                totals && (totals.fromCache !== null || totals.fromStorage !== null)
                  ? `${bytes(totals.fromCache)} from cache · ${bytes(totals.fromStorage)} fetched from storage`
                  : undefined
              }
            />
            <Figure
              label="Cache nodes"
              value={fleet ? num(caches.length, 0) : '—'}
              sub={fleet ? cacheLine(caches.length, fullest) : undefined}
            />
            <Figure
              label="Response time, p95"
              value={p95 ? num(p95.ms, 0) : '—'}
              unit={p95 ? 'ms' : undefined}
              sub={
                p95 ? (
                  p95.of > 1 ? (
                    `slowest of ${p95.of} cache nodes, last ${n} days`
                  ) : (
                    `${p95.node.host || p95.node.instance}, last ${n} days`
                  )
                ) : delivery ? (
                  <NotYet why="The cache nodes don’t report a response time the console can read yet.">
                    response time
                  </NotYet>
                ) : undefined
              }
            />
          </Figures>

          <Panel
            title="Served per day"
            subtitle="What readers received each day: bytes a cache node already held, and bytes it first fetched from a storage node."
          >
            {delivery ? (
              <TimeChart
                starts={series.map((p) => Date.parse(p.t))}
                stepMs={(delivery.step_s || 86_400) * 1000}
                series={[
                  {
                    key: 'cache',
                    label: 'From cache',
                    color: SERIES.billed,
                    values: series.map((p) => p.from_cache_bytes),
                    total: bytes(totals?.fromCache),
                  },
                  {
                    key: 'storage',
                    label: 'Fetched from storage',
                    color: SERIES.measured,
                    values: series.map((p) => p.from_storage_bytes),
                    total: bytes(totals?.fromStorage),
                  },
                ]}
                format={(v) => bytes(v)}
                axis={(v) => bytes(v).replace(' ', '')}
                label={`Bytes served from cache and fetched from storage, each day of the last ${n} days`}
                height={220}
                tableLabel="Day"
              />
            ) : (
              <Typography sx={text.secondary}>No delivery history to show.</Typography>
            )}
          </Panel>

          <Panel
            flush
            title="Nodes that served data"
            subtitle={`Cache nodes first, then storage nodes that served readers directly. Over the last ${n} days.`}
          >
            <RowsTable
              rows={rows}
              rowKey={(d) => d.key || d.instance}
              empty={delivery ? 'No node served data in this period.' : 'Delivery could not be read.'}
              groupHeader={(d, i) =>
                i === 0 || (rows[i - 1].mode === 'cache') !== (d.mode === 'cache')
                  ? d.mode === 'cache'
                    ? 'Cache nodes'
                    : 'Storage nodes, served directly'
                  : null
              }
              columns={[
                { label: 'Node', render: (d) => <NodeName host={d.host} instance={d.instance} /> },
                { label: 'Served', align: 'right', render: (d) => bytes(d.served_bytes) },
                { label: 'From cache', align: 'right', render: (d) => percent(d.from_cache_ratio, 1) },
                {
                  label: 'Requests from cache',
                  align: 'right',
                  render: (d) => percent(d.requests_from_cache_ratio, 1),
                },
                {
                  label: 'Response p95',
                  align: 'right',
                  render: (d) => (d.p95_ms !== null ? `${num(d.p95_ms, 0)} ms` : '—'),
                },
                {
                  label: 'Cache disk',
                  width: 300,
                  render: (d) => (d.mode === 'cache' ? <CacheDisk m={machines.get(d.key) ?? null} /> : null),
                },
              ]}
              detail={(d) => <NodeFacts d={d} m={machines.get(d.key) ?? null} />}
            />
          </Panel>
        </Stack>
      )}
    </>
  );
}

function servedLine(served: number | null, recorded: number, days: number): string {
  if (served === null || recorded === 0) return 'Nothing recorded in this period.';
  const gaps = days - recorded;
  return `about ${bytes(served / recorded)} a day${gaps > 0 ? ` · ${gaps} ${gaps === 1 ? 'day' : 'days'} not recorded` : ''}`;
}

function cacheLine(count: number, fullest: Machine | null): string {
  if (count === 0) return 'The metrics list no cache node.';
  if (!fullest) return 'Their disk use is not reported.';
  const name = fullest.host || fullest.instance;
  return `${count > 1 ? 'Fullest: ' : ''}${name}, ${percent(fullest.disk_used_bytes, fullest.disk_total_bytes)} of disk`;
}

/** A cache node's disk: the machine's total, delivery's quota (none yet) and what the cache uses. */
function CacheDisk({ m }: { m: Machine | null }) {
  if (!m) return <Typography sx={text.caption}>Not in the node metrics</Typography>;
  return (
    <QuotaBar total={m.disk_total_bytes} quota={null} used={m.disk_used_bytes} format={bytes} quotaMissing={NO_QUOTA} />
  );
}

function NodeFacts({ d, m }: { d: DeliveryNode; m: Machine | null }) {
  return (
    <Facts
      items={[
        ['Node key', d.key ? <Mono key="k">{d.key}</Mono> : '—'],
        ['Role', d.mode === 'cache' ? 'Caches data near readers' : 'Stores data and serves it directly'],
        ['Status now', m ? <UpStatus key="s" up={m.up} /> : 'Not in the node metrics'],
        ['Version', m?.version ?? '—'],
        ['Served, last 24 h', bytes(m?.served_24h_bytes)],
        ['Requests now', m && m.requests_per_s !== null ? `${num(m.requests_per_s)} a second` : '—'],
      ]}
    />
  );
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
