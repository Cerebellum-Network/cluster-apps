import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Button } from '@mui/material';
import { CheckCircleOutline } from '@mui/icons-material';

import type { DeliveryView, FleetView, StorageView } from '~/api/metricsTypes';
import type { ChainSnapshot, DACView, InferenceView, LiveView, NodesView, Summary, UsageView } from '~/api/types';
import { EraStrip, RankedBars, SERIES, TimeChart } from '~/components/charts';
import { color, hairline, Figure, Figures, Meter, PageHeader, Panel, Pill, text } from '~/components/ui';
import { bytes, hoursNumber, num, percent, vcpuHours } from '~/format';
import { useView } from '~/hooks/useView';

import { attention, type NodeSignal } from './attention';
import { fleetRows } from './fleetRows';
import { nodeCounts } from './nodeModel';

/** A trend inside a figure: one line, no axes; its numbers are on the page it opens. */
function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts.length < 2) return null;
  const max = Math.max(...pts.map((p) => p[1]));
  const min = Math.min(...pts.map((p) => p[1]));
  const w = 200;
  const h = 36;
  const x = (i: number) => (i / (values.length - 1)) * w;
  const y = (v: number) => (max === min ? h / 2 : h - 3 - ((v - min) / (max - min)) * (h - 6));
  const line = pts.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      sx={{ width: '100%', height: h, display: 'block' }}
    >
      <polygon
        points={`${x(pts[0][0])},${h} ${line} ${x(pts[pts.length - 1][0])},${h}`}
        fill={SERIES.one}
        opacity={0.1}
      />
      <polyline
        points={line}
        fill="none"
        stroke={SERIES.one}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </Box>
  );
}

/**
 * The canvas's Main board: what needs the manager first, then one figure per
 * area, each opening its page, then sandbox use over time and who uses it.
 */
export function Overview() {
  const nav = useNavigate();
  const summary = useView<Summary>('/summary');
  const nodes = useView<NodesView>('/nodes', undefined, 30_000);
  const chain = useView<ChainSnapshot>('/chain', undefined, 60_000);
  const fleet = useView<FleetView>('/fleet', undefined, 30_000);
  const storage = useView<StorageView>('/storage', { days: 30 }, 300_000);
  const delivery = useView<DeliveryView>('/delivery', { days: 15 }, 300_000);
  const inf = useView<InferenceView>('/inference');
  const live = useView<LiveView>('/live', undefined, 5_000);
  const usage = useView<UsageView>('/usage', { hours: 24 }, 60_000);
  const dac = useView<DACView>('/dac', { hours: 24 }, 60_000);
  const views = [summary, nodes, chain, fleet, storage, delivery, inf, live, usage, dac];

  const counts = chain.data ? nodeCounts(chain.data.nodes) : null;
  const rows = fleetRows(fleet.data, nodes.data, chain.data, dac.data);
  const down = rows.filter((r) => r.status === 'down' || r.status === 'silent').length;
  const kinds = [
    [rows.filter((r) => r.key.startsWith('m:') || r.key.startsWith('c:')).length, 'storage and cache'],
    [rows.filter((r) => r.key.startsWith('i:')).length, 'inference'],
    [rows.filter((r) => r.key.startsWith('a:')).length, 'agent runtime'],
  ]
    .filter(([n]) => n)
    .map(([n, l]) => `${n} ${l}`)
    .join(' · ');
  const storageNodes = fleet.data?.machines.filter((m) => m.mode === 'storage' || m.mode === 'full') ?? [];
  const diskUsed = storageNodes.reduce((a, m) => a + (m.disk_used_bytes ?? 0), 0);
  const diskTotal = storageNodes.reduce((a, m) => a + (m.disk_total_bytes ?? 0), 0);
  const served15 = delivery.data?.series.reduce((a, p) => a + (p.served_bytes ?? 0), 0) ?? null;
  const fromCache = delivery.data?.series.reduce((a, p) => a + (p.from_cache_bytes ?? 0), 0) ?? 0;
  const fromStorage = delivery.data?.series.reduce((a, p) => a + (p.from_storage_bytes ?? 0), 0) ?? 0;
  const models = inf.data?.models ?? [];
  const serving = models.filter((m) => m.ceiling > 0);
  const capacity = serving.reduce((a, m) => a + m.ceiling, 0);
  const inFlight = serving.reduce((a, m) => a + m.in_flight, 0);
  const sbx = live.data?.nodes.flatMap((n) => n.sandboxes) ?? [];
  const quota = live.data?.nodes.reduce((a, n) => a + (n.allocatable?.cpu ?? 0), 0) ?? 0;
  const requested = sbx.reduce((a, s) => a + s.resources.cpu, 0);
  const done = dac.data?.eras.filter((e) => e.status !== 'ERA_IN_PROGRESS') ?? [];
  const sealed = done.filter((e) => e.status !== 'ERA_FORCED_SKIPPED').length;

  const signals: NodeSignal[] = (fleet.data?.machines ?? []).map((m) => ({
    name: m.host || m.instance,
    diskUsed: m.mode !== 'cache' && m.disk_total_bytes ? (m.disk_used_bytes ?? 0) / m.disk_total_bytes : null,
    silentFor: m.last_seen ? (Date.now() - Date.parse(m.last_seen)) / 1000 : null,
  }));
  const items = summary.data ? attention({ summary: summary.data, nodes: nodes.data, usage: usage.data, signals }) : [];
  const series = usage.data?.series ?? [];

  return (
    <>
      <PageHeader
        title="Overview"
        updatedAt={summary.updatedAt}
        onRefresh={() => views.forEach((v) => v.refresh())}
        refreshing={summary.loading}
      />
      <Stack spacing={2}>
        <Panel title="Needs you">
          {!summary.data ? (
            <Typography sx={text.secondary}>Reading…</Typography>
          ) : items.length === 0 ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CheckCircleOutline sx={{ fontSize: 18, color: color.success }} />
              <Typography sx={{ ...text.secondary, color: color.text }}>Nothing needs you right now.</Typography>
            </Stack>
          ) : (
            <Stack sx={{ margin: '-6px 0' }}>
              {items.map((a, i) => (
                <Stack
                  key={a.title}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={{ xs: 0.75, sm: 2 }}
                  alignItems={{ sm: 'center' }}
                  sx={{ padding: '10px 0', borderTop: i ? hairline : 'none' }}
                >
                  <Box sx={{ width: 84, flexShrink: 0 }}>
                    <Pill tone={a.tone === 'bad' ? 'danger' : 'warning'}>{a.tag}</Pill>
                  </Box>
                  <Box flex={1} minWidth={0}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{a.title}</Typography>
                    <Typography sx={text.secondary}>{a.detail}</Typography>
                  </Box>
                  <Button size="small" variant="outlined" onClick={() => nav(a.to)} sx={{ flexShrink: 0 }}>
                    {a.action}
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
        </Panel>

        <Figures columns={3}>
          <Figure
            label="Nodes running"
            value={fleet.data || nodes.data ? rows.length : '…'}
            sub={
              fleet.data || nodes.data ? `${kinds} · ${down === 0 ? 'all up' : `${down} down or silent`}` : undefined
            }
            to="/nodes"
          >
            {counts && (
              <Typography sx={{ ...text.caption }}>
                On chain: {counts.machines} storage and cache nodes, {counts.compute} compute identities
              </Typography>
            )}
          </Figure>
          <Figure
            label="Storage"
            value={fleet.data ? bytes(diskUsed) : fleet.error ? '—' : '…'}
            unit={fleet.data && diskTotal ? `of ${bytes(diskTotal)}` : undefined}
            sub={
              fleet.data
                ? `${percent(diskUsed, diskTotal)} of disk on ${storageNodes.length} storage nodes`
                : fleet.error
                  ? 'Couldn’t read node metrics'
                  : undefined
            }
            to="/storage"
          >
            {storage.data && (
              <Sparkline values={storage.data.series.map((p) => p.used_bytes)} label="Disk used, last 30 days" />
            )}
          </Figure>
          <Figure
            label="Delivery, 15 days"
            value={served15 != null ? bytes(served15) : delivery.error ? '—' : '…'}
            sub={
              delivery.data
                ? `${percent(fromCache, fromCache + fromStorage)} served from cache`
                : delivery.error
                  ? 'Couldn’t read node metrics'
                  : undefined
            }
            to="/delivery"
          >
            {delivery.data && (
              <Sparkline
                values={delivery.data.series.map((p) => p.served_bytes)}
                label="Served per day, last 15 days"
              />
            )}
          </Figure>
          <Figure
            label="Inference, requests at once"
            value={inf.data ? num(inFlight, 0) : '…'}
            unit={inf.data ? `of ${num(capacity, 0)}` : undefined}
            sub={inf.data ? `now, all models together · ${serving.length} models serving` : undefined}
            to="/inference"
          >
            {inf.data && <Meter value={inFlight} max={capacity} label="Requests at once of capacity" />}
          </Figure>
          <Figure
            label="Sandboxes"
            value={live.data ? sbx.length : '…'}
            unit={live.data ? 'running' : undefined}
            sub={live.data ? `${num(requested, 2)} of ${num(quota, 1)} vCPU of the sandbox quota requested` : undefined}
            to="/sandboxes"
          >
            {live.data && <Meter value={requested} max={quota} label="vCPU requested of the sandbox quota" />}
          </Figure>
          <Figure
            label="Verified by DAC, 24 h"
            value={dac.data ? `${sealed} of ${done.length}` : '…'}
            unit={dac.data ? 'eras' : undefined}
            sub={
              dac.data
                ? `${bytes(dac.data.consumed.transferred_bytes)} delivered · earnings not available yet`
                : undefined
            }
            to="/revenue"
          >
            {dac.data && <EraStrip eras={dac.data.eras} compact />}
          </Figure>
        </Figures>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 2 }}>
          <Panel
            title="Sandbox use, last 24 h"
            subtitle="vCPU-hours per hour: what customers are billed, and what sandboxes used."
          >
            {usage.data && (
              <TimeChart
                starts={series.map((p) => Date.parse(p.start))}
                stepMs={usage.data.step_s * 1000}
                series={[
                  {
                    key: 'b',
                    label: 'Billed',
                    color: SERIES.billed,
                    values: series.map((p) => p.billed_cpu_s),
                    total: vcpuHours(usage.data.totals.billed_cpu_s),
                  },
                  {
                    key: 'm',
                    label: 'Measured',
                    color: SERIES.measured,
                    values: series.map((p) => p.cpu_s),
                    total: vcpuHours(usage.data.totals.cpu_s),
                  },
                ]}
                format={(x) => vcpuHours(x)}
                axis={(x) => hoursNumber(x)}
                label="Sandbox vCPU-hours per hour, billed and measured, last 24 hours"
                height={180}
              />
            )}
          </Panel>
          <Panel title="Top customers, 24 h" subtitle="Billed vCPU-hours on sandboxes.">
            {usage.data && (
              <RankedBars
                rows={usage.data.by_bucket.slice(0, 5).map((b) => ({
                  key: `${b.bucket}`,
                  label: `Bucket ${b.bucket}`,
                  sub: `${b.sandboxes} sandboxes`,
                  value: b.billed_cpu_s,
                  display: vcpuHours(b.billed_cpu_s),
                  title: `Bucket ${b.bucket}: ${vcpuHours(b.billed_cpu_s)} billed`,
                }))}
                empty="No customer used sandboxes in the last 24 h."
              />
            )}
          </Panel>
        </Box>
      </Stack>
    </>
  );
}
