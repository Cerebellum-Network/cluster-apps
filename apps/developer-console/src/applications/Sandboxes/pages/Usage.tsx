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
import { countingState, recordBilling } from '~/compute/billing';
import { isLive, type UsageRecord } from '~/compute/types';
import { chartPalette, color, mono, text } from '~/theme/tokens';
import { CountedLabel } from '../components/detail/RecordsTable';
import { BucketChip, ReadError } from '../components/ui';
import { Chip } from './SandboxList';

const WINDOWS = [
  { id: '1h', label: 'Last hour', ms: 3600_000, barMs: 60_000 },
  { id: '24h', label: '24 hours', ms: 86_400_000, barMs: 30 * 60_000 },
  { id: '7d', label: '7 days', ms: 7 * 86_400_000, barMs: 6 * 3600_000 },
] as const;

const TICK = { fontSize: 12, fill: color.textTertiary };
/** Fixed series order: billed is the first hue, measured the second (validated for colour-blind separation). */
const BILLED_COLOR = chartPalette[0];
const MEASURED_COLOR = chartPalette[1];

const Tile = ({ label, value, sub, note }: { label: string; value: string; sub: string; note?: string }) => (
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
    <Typography sx={{ ...text.caption, marginTop: '2px' }}>{sub}</Typography>
    {note && <Typography sx={{ ...text.caption, marginTop: '1px' }}>{note}</Typography>}
  </Box>
);

/** Records summed into bars by the end of their period: billed and measured, CPU and memory. */
function bars(records: UsageRecord[], fromMs: number, toMs: number, barMs: number) {
  const start = Math.floor(fromMs / barMs) * barMs;
  const n = Math.max(1, Math.ceil((toMs - start) / barMs));
  const rows = Array.from({ length: n }, (_, i) => ({
    t: start + i * barMs,
    cpu: 0,
    ram: 0,
    billedCpu: 0,
    billedRam: 0,
  }));
  for (const r of records) {
    const i = Math.floor((Date.parse(r.period_end) - start) / barMs);
    if (i < 0 || i >= n) continue;
    const b = recordBilling(r);
    rows[i].cpu += r.cpu_s;
    rows[i].ram += r.ram_gib_s;
    rows[i].billedCpu += b.cpu;
    rows[i].billedRam += b.ram;
  }
  return rows;
}

/** One quantity over time, billed (bars) against measured (line), on one axis in one unit. */
const BilledChart = ({
  title,
  rows,
  billedKey,
  measuredKey,
  unit,
  barMs,
}: {
  title: string;
  rows: ReturnType<typeof bars>;
  billedKey: 'billedCpu' | 'billedRam';
  measuredKey: 'cpu' | 'ram';
  unit: string;
  barMs: number;
}) => {
  const dayHour = (t: number) =>
    new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const tick = (t: number) => (barMs >= 3600_000 ? dayHour(t) : fmtClock(t).slice(0, 5));
  return (
    <Section title={`${title} (${localZone()})`}>
      <Box
        role="img"
        aria-label={`${title} billed and measured, one bar per ${barMs / 60_000} minutes`}
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
              labelFormatter={(t: number) => `${dayHour(t)}–${fmtClock(t + barMs).slice(0, 5)} ${localZone(t)}`}
              formatter={(v, name) => [`${fmtQty(Number(v))} ${unit}`, name]}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: color.border }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={24}
              iconSize={10}
              wrapperStyle={{ fontSize: 12, color: color.textSecondary }}
            />
            <Bar
              dataKey={billedKey}
              name="Billed"
              fill={BILLED_COLOR}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
            <Line
              dataKey={measuredKey}
              name="Measured"
              type="monotone"
              stroke={MEASURED_COLOR}
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
 * Usage (`GET /v1/usage/records`, this bucket): what sandboxes were billed and
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
          label: sb ? (sb.labels['cere.agent'] ? `agent ${sb.labels['cere.agent']}` : sb.image) : '',
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
          subtitle="What your sandboxes are billed: the CPU and memory each one reserves, for as long as it runs, or what it used where that is more. Billed to your compute bucket; there is no price list yet."
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
            <Tile label="Billed CPU-seconds" value={fmtQty(total.billed_cpu_s)} sub={`used ${fmtQty(total.cpu_s)}`} />
            <Tile
              label="Billed GiB-seconds of memory"
              value={fmtQty(total.billed_ram_gib_s)}
              sub={`used ${fmtQty(total.ram_gib_s)}`}
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
            <BilledChart
              title="CPU-seconds"
              rows={rows}
              billedKey="billedCpu"
              measuredKey="cpu"
              unit="CPU-s"
              barMs={w.barMs}
            />
            <BilledChart
              title="GiB-seconds"
              rows={rows}
              billedKey="billedRam"
              measuredKey="ram"
              unit="GiB-s"
              barMs={w.barMs}
            />
          </Box>

          <Section title="By sandbox" flush>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Sandbox</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell align="right">Billed CPU-s</TableCell>
                    <TableCell align="right">Used CPU-s</TableCell>
                    <TableCell align="right">Billed GiB-s</TableCell>
                    <TableCell align="right">Used GiB-s</TableCell>
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
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {fmtQty(r.billed_cpu_s)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: color.textSecondary }}>
                        {fmtQty(r.cpu_s)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {fmtQty(r.billed_ram_gib_s)}
                      </TableCell>
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
