import { useMemo, useState } from 'react';
import {
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@cluster-apps/ui';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NavLink } from 'react-router-dom';

import { PageHeader, Section } from '~/components';
import { useCompute } from '~/compute/ComputeProvider';
import { useSandboxes, useUsageRecords } from '~/compute/hooks';
import { fmtBytes, fmtClock, fmtQty, localZone, shortId, sumRecords } from '~/compute/format';
import {
  CACHE_NOTE,
  countingState,
  measuredIncludesCache,
  recordParts,
  shownParts,
  type BilledParts,
} from '~/compute/billing';
import { isLive, type UsageRecord } from '~/compute/types';
import { chartPalette, color, mono, text } from '~/theme/tokens';
import { BilledCell, CountedLabel } from '../components/detail/RecordsTable';
import { BucketChip, ReadError } from '../components/ui';
import { Chip } from './SandboxList';

const WINDOWS = [
  { id: '1h', label: 'Last hour', ms: 3600_000, barMs: 60_000 },
  { id: '24h', label: '24 hours', ms: 86_400_000, barMs: 30 * 60_000 },
  { id: '7d', label: '7 days', ms: 7 * 86_400_000, barMs: 6 * 3600_000 },
] as const;

const TICK = { fontSize: 12, fill: color.textTertiary };

/**
 * The parts of a bill, in a fixed order with fixed colours (validated for
 * colour-blind separation): the request first, the burst above it,
 * then what was billed as measured (older records), which shows only when
 * there is some. What was used is a line in ink, not a part of the bill.
 */
const PARTS = [
  { key: 'floor', name: 'Request', color: chartPalette[0] },
  { key: 'burst', name: 'Burst', color: chartPalette[1] },
  { key: 'asMeasured', name: 'Billed as measured', color: chartPalette[2] },
] as const;
const USED_COLOR = color.text;

const Swatch = ({ tone }: { tone: string }) => (
  <Box
    component="span"
    aria-hidden
    sx={{ display: 'inline-block', width: 9, height: 9, borderRadius: '2px', backgroundColor: tone, flexShrink: 0 }}
  />
);

/** A bill's parts with their colours, as the chart below draws them: "■ 15.0 request ■ 3.20 burst". */
const PartsKey = ({ p: bill }: { p: BilledParts }) => {
  // At the total's precision, so the parts add up to the total shown above them.
  const { parts: p, fmt } = shownParts(bill);
  return (
    <Stack direction="row" gap="4px 14px" flexWrap="wrap" sx={{ marginTop: '6px' }}>
      {PARTS.filter((x) => x.key !== 'asMeasured' || p.asMeasured > 0).map((x) => (
        <Stack key={x.key} direction="row" alignItems="center" gap="6px" component="span">
          <Swatch tone={x.color} />
          <Typography component="span" sx={{ ...text.caption, color: color.text, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(p[x.key])} {x.name.toLowerCase()}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
};

const Tile = ({ label, value, parts, sub }: { label: string; value: string; parts?: BilledParts; sub: string }) => (
  <Box
    sx={{
      border: `1px solid ${color.border}`,
      borderRadius: '16px',
      backgroundColor: color.surface,
      padding: '16px 18px',
      minWidth: 0,
    }}
  >
    <Typography sx={text.secondary}>{label}</Typography>
    <Typography sx={{ ...text.title, fontVariantNumeric: 'tabular-nums', marginTop: '6px' }}>{value}</Typography>
    {parts && <PartsKey p={parts} />}
    <Typography sx={{ ...text.caption, marginTop: '4px' }}>{sub}</Typography>
  </Box>
);

type Row = {
  t: number;
  cpu: { floor: number; burst: number; asMeasured: number; used: number };
  ram: { floor: number; burst: number; asMeasured: number; used: number };
};

/** Records summed into bars by the end of their period: the billed parts and what was used, CPU and memory. */
function bars(records: UsageRecord[], fromMs: number, toMs: number, barMs: number): Row[] {
  const start = Math.floor(fromMs / barMs) * barMs;
  const n = Math.max(1, Math.ceil((toMs - start) / barMs));
  const rows: Row[] = Array.from({ length: n }, (_, i) => ({
    t: start + i * barMs,
    cpu: { floor: 0, burst: 0, asMeasured: 0, used: 0 },
    ram: { floor: 0, burst: 0, asMeasured: 0, used: 0 },
  }));
  for (const r of records) {
    const i = Math.floor((Date.parse(r.period_end) - start) / barMs);
    if (i < 0 || i >= n) continue;
    const p = recordParts(r);
    for (const [q, parts, used] of [
      ['cpu', p.cpu, r.cpu_s],
      ['ram', p.ram, r.ram_gib_s],
    ] as const) {
      rows[i][q].floor += parts.floor;
      rows[i][q].burst += parts.burst;
      rows[i][q].asMeasured += parts.asMeasured;
      rows[i][q].used += used;
    }
  }
  return rows;
}

const dayHour = (t: number) =>
  new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** The hover card: the bar's time, what it billed in parts, and what was used. */
const ChartTip = ({
  active,
  payload,
  quantity,
  unit,
  barMs,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  quantity: 'cpu' | 'ram';
  unit: string;
  barMs: number;
}) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const q = row[quantity];
  const billed = q.floor + q.burst + q.asMeasured;
  const line = (tone: string | null, name: string, v: number, strong = false) => (
    <Stack direction="row" alignItems="center" gap="8px" justifyContent="space-between" key={name}>
      <Stack direction="row" alignItems="center" gap="6px">
        {tone ? <Swatch tone={tone} /> : <Box component="span" sx={{ width: 9 }} />}
        <span>{name}</span>
      </Stack>
      <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 700 : 500 }}>
        {fmtQty(v)} {unit}
      </Box>
    </Stack>
  );
  return (
    <Box
      sx={{
        backgroundColor: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: '8px',
        padding: '8px 10px',
        fontSize: 12,
        lineHeight: '18px',
        color: color.text,
        minWidth: 190,
        boxShadow: '0 2px 8px rgba(29, 27, 32, 0.08)',
      }}
    >
      <Box sx={{ color: color.textSecondary, marginBottom: '4px' }}>
        {dayHour(row.t)}–{fmtClock(row.t + barMs).slice(0, 5)} {localZone(row.t)}
      </Box>
      {line(null, 'Billed', billed, true)}
      {PARTS.filter((x) => x.key !== 'asMeasured' || q.asMeasured > 0).map((x) => line(x.color, x.name, q[x.key]))}
      <Box sx={{ borderTop: `1px solid ${color.grid}`, marginTop: '4px', paddingTop: '4px' }}>
        {line(USED_COLOR, 'Measured', q.used)}
        {quantity === 'ram' && measuredIncludesCache(q.used, billed) && (
          <Box sx={{ color: color.textSecondary, maxWidth: 220 }}>File cache is measured, not billed.</Box>
        )}
      </Box>
    </Box>
  );
};

/**
 * One quantity over time: what was billed as stacked bars (the guaranteed
 * floor, the burst above it, and what older records billed as measured) with
 * what was used as a line, on one axis in one unit.
 */
const BilledChart = ({
  title,
  rows,
  quantity,
  unit,
  barMs,
}: {
  title: string;
  rows: Row[];
  quantity: 'cpu' | 'ram';
  unit: string;
  barMs: number;
}) => {
  const tick = (t: number) => (barMs >= 3600_000 ? dayHour(t) : fmtClock(t).slice(0, 5));
  const anyMeasured = rows.some((r) => r[quantity].asMeasured > 0);
  const shown = PARTS.filter((x) => x.key !== 'asMeasured' || anyMeasured);
  const top = shown[shown.length - 1].key;
  return (
    <Section title={`${title} (${localZone()})`}>
      <Box
        role="img"
        aria-label={`${title}: billed as request and burst, against what was measured, one bar per ${barMs / 60_000} minutes`}
        sx={{ width: '100%', height: 220 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={color.grid} />
            <XAxis
              dataKey="t"
              tickFormatter={tick}
              minTickGap={40}
              tick={TICK}
              tickLine={false}
              stroke={color.border}
            />
            <YAxis width={52} tickFormatter={(v: number) => fmtQty(v)} tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: color.grid }}
              content={<ChartTip quantity={quantity} unit={unit} barMs={barMs} />}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={24}
              iconSize={10}
              wrapperStyle={{ fontSize: 12 }}
              // The swatch carries the series; its name stays in text ink.
              formatter={(name: string) => <span style={{ color: color.textSecondary }}>{name}</span>}
            />
            {shown.map((x) => (
              <Bar
                key={x.key}
                dataKey={(r: Row) => r[quantity][x.key]}
                name={x.name}
                stackId="billed"
                fill={x.color}
                stroke={color.surface}
                strokeWidth={1}
                radius={x.key === top ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
            <Line
              dataKey={(r: Row) => r[quantity].used}
              name="Measured"
              type="monotone"
              stroke={USED_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
    </Section>
  );
};

/**
 * Usage (`GET /v1/sandboxes/usage/records`, this bucket): what sandboxes were billed and
 * what they used, over time and by sandbox, and whether it has all been
 * counted for billing. A sandbox's minute-by-minute usage is on its own Usage
 * tab. There is no price list for sandboxes yet, so nothing is money.
 */
const Usage = () => {
  const { bucketId } = useCompute();
  const [win, setWin] = useState<(typeof WINDOWS)[number]['id']>('24h');
  const w = WINDOWS.find((x) => x.id === win)!;
  const since = useMemo(() => new Date(Date.now() - w.ms).toISOString(), [w.ms]);
  const { data, error } = useUsageRecords({ since });
  const sandboxes = useSandboxes();
  const records = useMemo(() => data?.items ?? [], [data]);
  const total = sumRecords(records);
  const waiting = records.filter((r) => r.dac_status === 'pending').length;
  const refused = records.filter((r) => r.dac_status === 'failed').length;
  const rows = bars(records, Date.parse(since), Date.now(), w.barMs);

  const bySandbox = useMemo(() => {
    const m = new Map<string, UsageRecord[]>();
    for (const r of records) m.set(r.sandbox_id, [...(m.get(r.sandbox_id) ?? []), r]);
    const known = new Map((sandboxes.data?.items ?? []).map((s) => [s.id, s]));
    return [...m.entries()]
      .map(([id, rs]) => {
        const sb = known.get(id);
        return {
          id,
          label: sb ? (sb.labels['cere.agent'] ? `agent ${sb.labels['cere.agent']}` : sb.image.ref) : '',
          live: sb ? isLive(sb.status) : !rs.some((r) => r.final),
          counted: countingState(rs),
          ...sumRecords(rs),
        };
      })
      .sort((a, b) => b.billed_cpu_s - a.billed_cpu_s);
  }, [records, sandboxes.data]);

  return (
    <Box>
      <Box marginBottom="16px">
        <PageHeader
          title="Usage"
          subtitle="What your sandboxes are billed: the CPU and memory each one is guaranteed (its request) for as long as it runs, plus any use above that, the burst. Billed to your compute bucket; there is no price list yet."
          actions={<BucketChip bucketId={bucketId} />}
        />
      </Box>

      <Stack direction="row" gap="8px" marginBottom="16px" alignItems="center" flexWrap="wrap">
        {WINDOWS.map((x) => (
          <Chip key={x.id} active={win === x.id} onClick={() => setWin(x.id)}>
            {x.label}
          </Chip>
        ))}
        <Box flex={1} />
        {error && data && (
          <Typography sx={{ ...text.caption, color: color.danger }} title={error}>
            Refresh failed; showing the last read.
          </Typography>
        )}
        {data && records.length > 0 && (
          <Typography sx={{ ...text.secondary, color: refused ? color.danger : color.textSecondary }}>
            {refused
              ? `${refused} minute${refused === 1 ? '' : 's'} not counted for billing`
              : waiting
                ? `${waiting} minute${waiting === 1 ? '' : 's'} waiting to be counted`
                : 'All counted for billing'}
          </Typography>
        )}
      </Stack>

      {error && !data ? (
        <ReadError what="your usage" error={error} />
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <Tile
              label="Billed CPU-seconds"
              value={fmtQty(total.billed_cpu_s)}
              parts={total.cpu}
              sub={`measured ${fmtQty(total.cpu_s)}`}
            />
            <Tile
              label="Billed GiB-seconds of memory"
              value={fmtQty(total.billed_ram_gib_s)}
              parts={total.ram}
              sub={`measured ${fmtQty(total.ram_gib_s)}${
                measuredIncludesCache(total.ram_gib_s, total.billed_ram_gib_s) ? `, ${CACHE_NOTE}` : ''
              }`}
            />
            <Tile
              label="Network"
              value={fmtBytes(total.net_egress_bytes + total.net_ingress_bytes)}
              sub={`out ${fmtBytes(total.net_egress_bytes)}, in ${fmtBytes(total.net_ingress_bytes)}; not billed`}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
              gap: '16px',
              marginBottom: '16px',
            }}
          >
            <BilledChart title="CPU-seconds" rows={rows} quantity="cpu" unit="CPU-s" barMs={w.barMs} />
            <BilledChart title="GiB-seconds" rows={rows} quantity="ram" unit="GiB-s" barMs={w.barMs} />
          </Box>

          <Section title="By sandbox" flush>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Sandbox</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell align="right">Billed CPU-s</TableCell>
                    <TableCell align="right">Measured CPU-s</TableCell>
                    <TableCell align="right">Billed GiB-s</TableCell>
                    <TableCell align="right">Measured GiB-s</TableCell>
                    <TableCell>Billing</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bySandbox.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell
                        sx={{ whiteSpace: 'nowrap', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        <Box
                          component={NavLink}
                          to={`/sandboxes/list/${r.id}?tab=usage`}
                          sx={{
                            fontFamily: mono,
                            fontSize: 12.5,
                            color: color.text,
                            textDecoration: 'none',
                            '&:hover': { color: color.primary },
                          }}
                        >
                          {shortId(r.id)}
                        </Box>
                        {r.label && (
                          <Box component="span" sx={{ ...text.caption, marginLeft: '8px' }}>
                            {r.label}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{r.live ? 'Running' : 'Ended'}</TableCell>
                      <BilledCell p={r.cpu} />
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: color.textSecondary }}>
                        {fmtQty(r.cpu_s)}
                      </TableCell>
                      <BilledCell p={r.ram} />
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: color.textSecondary }}>
                        {fmtQty(r.ram_gib_s)}
                      </TableCell>
                      <TableCell>{r.counted ? <CountedLabel status={r.counted} /> : null}</TableCell>
                    </TableRow>
                  ))}
                  {bySandbox.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ textAlign: 'center', padding: '28px' }}>
                        <Typography sx={text.secondary}>{data ? 'No usage in this window.' : 'Reading…'}</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>
        </>
      )}
    </Box>
  );
};

export default Usage;
