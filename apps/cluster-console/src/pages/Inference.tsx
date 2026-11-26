import { useMemo, useRef, type ReactNode } from 'react';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';

import type { FleetView, InferenceHistory, InferenceNodeMetrics } from '~/api/metricsTypes';
import type { DACView, InferenceView, ModelOnNode } from '~/api/types';
import { QuotaBar, SERIES, TimeChart } from '~/components/charts';
import { useFilters } from '~/components/Filters';
import {
  color,
  CouldNotRead,
  Facts,
  Figure,
  Figures,
  hairline,
  Loading,
  Meter,
  Mono,
  NotYet,
  PageHeader,
  Panel,
  RowsTable,
  SectionTitle,
  Status,
  text,
} from '~/components/ui';
import { ago, bytes, compact, num, percent, shortKey } from '~/format';
import { useView } from '~/hooks/useView';

import { aligned, joinModels, lastKnown, missingLine, nowLoad, peakOf, sumKnown, type ModelRow } from './serviceMath';

const NO_QUOTA = 'The resource manager does not reserve a per-service quota yet.';
const DEFAULT_DAYS = 7;

/**
 * Inference (mockup b2): the cluster first (requests at once now, the peak,
 * refusals, GPU units), then one row per model that opens in place on the
 * nodes serving it, then the GPUs.
 */
export function Inference() {
  const f = useFilters(['days']);
  const days = f.values.days === '30' ? 30 : DEFAULT_DAYS;
  const iv = useView<InferenceView>('/inference', undefined, 30_000);
  const hv = useView<InferenceHistory>('/inference/history', { days }, 300_000);
  const dv = useView<DACView>('/dac', { hours: 24 }, 300_000);
  const fv = useView<FleetView>('/fleet', undefined, 60_000);
  const hist = useHeld(hv.data);
  const now = iv.data;
  const n = hist?.days ?? days;

  const load = now ? nowLoad(now.models) : null;
  const peak = hist ? peakOf(hist.total.peak_in_flight) : null;
  const capacityOnPeak = peak ? (hist?.total.capacity.find((p) => p.t === peak.t)?.v ?? null) : null;
  const refusedFull = hist ? sumKnown(hist.total.refused_model_full.map((p) => p.v)) : null;
  const refusedLimit = hist ? sumKnown(hist.total.refused_customer_limit.map((p) => p.v)) : null;
  const gpuUnits = hist ? sumKnown(hist.total.gpu_units.map((p) => p.v)) : null;
  const chart = useMemo(() => (hist ? aligned([hist.total.peak_in_flight, hist.total.capacity]) : null), [hist]);
  const rows = useMemo(() => joinModels(now?.models ?? null, hist?.models ?? null), [now, hist]);
  const gpuNodes = useMemo(
    () => [...(fv.data?.inference ?? [])].sort((a, b) => a.node.localeCompare(b.node)),
    [fv.data],
  );

  const stale = hv.loading && hist !== hv.data;
  const missing = missingLine([now?.missing, hist?.missing, fv.data?.missing]);
  const settled = (now || iv.error) && (hist || hv.error);

  return (
    <>
      <PageHeader
        title="Inference"
        subtitle="Whether the models keep up: requests at once against capacity, refusals and GPU units served, then each model and GPU."
        updatedAt={iv.updatedAt ?? hv.updatedAt}
        onRefresh={() => [iv, hv, dv, fv].forEach((x) => x.refresh())}
        refreshing={iv.loading || hv.loading}
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
          {iv.error && !now && <CouldNotRead error={iv.error} what="the models now" />}
          {hv.error && !hist && <CouldNotRead error={hv.error} what="inference history" />}
          {dv.error && !dv.data && <CouldNotRead error={dv.error} what="GPU units verified by DAC" />}
          {missing && <CouldNotRead error={missing} what="some inference readings" />}

          <Figures columns={4}>
            <Figure
              label="Requests at once, now"
              value={load ? `${num(load.inFlight, 0)} of ${num(load.capacity, 0)}` : '—'}
              sub={
                load
                  ? load.capacity > 0
                    ? 'in flight of capacity, all models together'
                    : 'No model has capacity now.'
                  : undefined
              }
            >
              {load && load.capacity > 0 && (
                <Meter value={load.inFlight} max={load.capacity} label="Requests in flight of capacity, all models" />
              )}
            </Figure>
            <Figure
              label={`Peak, ${n} days`}
              value={peak ? num(peak.v, 0) : '—'}
              sub={
                peak
                  ? `requests at once on ${utcDay(peak.t)}${capacityOnPeak !== null ? `, of ${num(capacityOnPeak, 0)} capacity` : ''}`
                  : hist
                    ? 'No reading in this period.'
                    : undefined
              }
            />
            <Figure
              label={`Refused, ${n} days`}
              value={num(sumKnown([refusedFull, refusedLimit]), 0)}
              sub={hist ? `${num(refusedFull, 0)} model full · ${num(refusedLimit, 0)} customer at limit` : undefined}
            />
            <Figure
              label={`GPU units served, ${n} days`}
              value={units(gpuUnits)}
              sub={`as the gateway counts them · DAC verified ${dv.data ? units(dv.data.consumed.gpu_units) : dv.loading ? '…' : '—'} in its own units, last 24 h`}
            />
          </Figures>

          <Panel
            title="All models, requests at once, daily peak"
            subtitle="The most requests in flight at once each day across all models, against the capacity reported that day."
          >
            {hist && chart ? (
              <TimeChart
                starts={chart.starts}
                stepMs={(hist.step_s || 86_400) * 1000}
                series={[
                  {
                    key: 'peak',
                    label: 'Daily peak',
                    color: SERIES.billed,
                    values: chart.values[0],
                    total: peak ? `highest ${num(peak.v, 0)}` : '—',
                  },
                  {
                    key: 'capacity',
                    label: 'Capacity',
                    color: SERIES.measured,
                    values: chart.values[1],
                    total: `latest ${num(
                      lastKnown(hist.total.capacity, (p) => p.v),
                      0,
                    )}`,
                  },
                ]}
                format={(v) => num(v, 0)}
                axis={(v) => compact(v)}
                label={`Daily peak of requests in flight at once, all models, and capacity, last ${n} days`}
                height={220}
                tableLabel="Day"
              />
            ) : (
              <Typography sx={text.secondary}>No inference history to show.</Typography>
            )}
          </Panel>

          <Panel flush title="Models" subtitle="Open a model for the nodes serving it.">
            <RowsTable
              rows={rows}
              rowKey={(r) => r.name}
              empty="No node lists a model, and no model served in this period."
              columns={[
                {
                  label: 'Model',
                  render: (r) => (
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{r.name}</Typography>
                      {r.versions.length > 0 && <Typography sx={text.caption}>{r.versions.join(', ')}</Typography>}
                    </Box>
                  ),
                },
                { label: 'Nodes ready', render: (r) => readyLine(r.nodes) },
                { label: 'Capacity at once', align: 'right', render: (r) => num(r.ceiling, 0) },
                { label: 'In flight now', align: 'right', render: (r) => num(r.inFlight, 0) },
                { label: `Peak, ${n} days`, align: 'right', render: (r) => num(r.history?.peak_in_flight, 0) },
                {
                  label: (
                    <Box>
                      Refused
                      <Box component="span" sx={{ display: 'block', fontWeight: 400 }}>
                        model full · customer at limit
                      </Box>
                    </Box>
                  ),
                  align: 'right',
                  render: (r) =>
                    r.history
                      ? `${num(r.history.refused_model_full, 0)} · ${num(r.history.refused_customer_limit, 0)}`
                      : '—',
                },
                { label: `GPU units, ${n} days`, align: 'right', render: (r) => units(r.history?.gpu_units) },
                { label: 'Load', width: 150, render: (r) => <Load r={r} /> },
              ]}
              detail={(r) => <ModelNodes nodes={r.nodes} />}
            />
          </Panel>

          <Stack spacing={0.75}>
            <NotYet why="The console reads each day’s peak, not how long a model stayed at its limit.">
              time at capacity.
            </NotYet>
            <NotYet why="Which customers reached their own limit comes from the inference gateway’s per-customer metrics, which the console doesn’t read yet.">
              customers at their limit.
            </NotYet>
          </Stack>

          <Box>
            <SectionTitle sub="Each inference node’s GPUs now. A loaded model holds its memory even when idle.">
              GPUs
            </SectionTitle>
            <Panel flush>
              {fv.error && !fv.data ? (
                <Box sx={{ padding: '16px 22px' }}>
                  <CouldNotRead error={fv.error} what="the GPUs" />
                </Box>
              ) : !fv.data ? (
                <Loading />
              ) : (
                <RowsTable
                  rows={gpuNodes}
                  rowKey={(g) => g.node}
                  empty="The metrics list no inference node."
                  columns={[
                    {
                      label: 'Node',
                      render: (g) => <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{g.node}</Typography>,
                    },
                    { label: 'Version', render: (g) => g.version ?? '—' },
                    { label: 'Status', render: (g) => <UpStatus up={g.up} /> },
                    {
                      label: 'GPU utilisation',
                      render: (g) => (
                        <PerGpu node={g} render={(gpu, i) => `GPU ${i + 1}: ${percent(gpu.utilization, 1)}`} />
                      ),
                    },
                    {
                      label: 'VRAM',
                      width: 340,
                      render: (g) => (
                        <PerGpu
                          node={g}
                          render={(gpu) => (
                            <Box sx={{ width: '100%' }}>
                              <QuotaBar
                                total={gpu.memory_total_bytes}
                                quota={null}
                                used={gpu.memory_used_bytes}
                                format={bytes}
                                quotaMissing={NO_QUOTA}
                                totalLabel="of GPU memory"
                              />
                            </Box>
                          )}
                        />
                      ),
                    },
                  ]}
                  detail={(g) => (
                    <Facts
                      items={[
                        ['Last reading', ago(g.last_seen)],
                        ...g.gpus.map((gpu, i): [string, ReactNode] => [
                          `GPU ${i + 1}`,
                          <Mono key={gpu.id}>{gpu.id}</Mono>,
                        ]),
                      ]}
                    />
                  )}
                />
              )}
            </Panel>
          </Box>
        </Stack>
      )}
    </>
  );
}

/** GPU units: two decimals under 10, then compact. */
function units(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return Math.abs(v) < 10 ? num(v, 2) : compact(v);
}

/** A UTC day (the history's days are UTC) as `Nov 21`. */
const utcDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function readyLine(nodes: ModelOnNode[] | null): string {
  if (nodes === null) return '—';
  if (nodes.length === 0) return 'None now';
  return `${nodes.filter((x) => x.status === 'ready').length} ready of ${nodes.length}`;
}

function Load({ r }: { r: ModelRow }) {
  if (r.ceiling === null || r.inFlight === null) return <>—</>;
  if (r.ceiling === 0) return <Typography sx={text.caption}>No capacity</Typography>;
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ flex: 1, minWidth: 60 }}>
        <Meter value={r.inFlight} max={r.ceiling} label={`${r.name}: in flight of capacity`} />
      </Box>
      <Typography sx={{ fontSize: 12.5, width: 36, textAlign: 'right' }}>{percent(r.inFlight, r.ceiling)}</Typography>
    </Stack>
  );
}

const NODE_GRID = {
  display: 'grid',
  gridTemplateColumns: 'minmax(180px, 2fr) repeat(3, minmax(90px, 1fr))',
  columnGap: 2,
};

/** The nodes serving one model: host, state, in flight and limit. */
function ModelNodes({ nodes }: { nodes: ModelOnNode[] | null }) {
  if (nodes === null) return <Typography sx={text.secondary}>The nodes could not be read.</Typography>;
  if (nodes.length === 0) return <Typography sx={text.secondary}>No node lists this model now.</Typography>;
  return (
    <Box sx={{ maxWidth: 720 }}>
      <Box sx={{ ...NODE_GRID, paddingBottom: '6px', borderBottom: hairline }}>
        <Typography sx={text.label}>Node</Typography>
        <Typography sx={text.label}>Status</Typography>
        <Typography sx={{ ...text.label, textAlign: 'right' }}>In flight</Typography>
        <Typography sx={{ ...text.label, textAlign: 'right' }}>Limit</Typography>
      </Box>
      {nodes.map((x) => (
        <Box
          key={x.node}
          sx={{ ...NODE_GRID, alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${color.grid}` }}
        >
          <Box minWidth={0}>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{x.host || shortKey(x.node)}</Typography>
            {x.host && x.node !== x.host && <Mono title={x.node}>{shortKey(x.node, 8, 6)}</Mono>}
          </Box>
          <NodeState x={x} />
          <Typography sx={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {num(x.in_flight, 0)}
          </Typography>
          <Typography sx={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {num(x.ceiling, 0)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function NodeState({ x }: { x: ModelOnNode }) {
  if (!x.healthy) return <Status tone="danger">Not healthy</Status>;
  if (x.status === 'ready') return <Status tone="success">Ready</Status>;
  const words = x.status ? x.status[0].toUpperCase() + x.status.slice(1).replace(/_/g, ' ') : 'No status';
  return <Status tone="neutral">{words}</Status>;
}

/** One line per GPU of a node, the same height in each column so they line up. */
function PerGpu({
  node,
  render,
}: {
  node: InferenceNodeMetrics;
  render: (gpu: InferenceNodeMetrics['gpus'][number], i: number) => ReactNode;
}) {
  if (node.gpus.length === 0) return <Typography sx={text.caption}>No GPU reported</Typography>;
  return (
    <Stack spacing={1}>
      {node.gpus.map((gpu, i) => (
        <Box key={gpu.id || i} sx={{ minHeight: 36, display: 'flex', alignItems: 'center' }}>
          {render(gpu, i)}
        </Box>
      ))}
    </Stack>
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
