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
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NavLink } from 'react-router-dom';

import { PageHeader, Section } from '~/components';
import { useCompute } from '~/compute/ComputeProvider';
import { useSandboxes, useUsageRecords } from '~/compute/hooks';
import { fmtBytes, fmtClock, fmtDateTime, fmtQty, fmtUnits, shortId, sumRecords, sumUnits } from '~/compute/format';
import type { UsageRecord } from '~/compute/types';
import { chartPalette, color, mono, text } from '~/theme/tokens';
import RecordsTable from '../components/detail/RecordsTable';
import { BucketChip, ReadError } from '../components/ui';
import { Chip } from './SandboxList';

const WINDOWS = [
  { id: '1h', label: 'Last hour', ms: 3600_000, barMs: 60_000 },
  { id: '24h', label: '24 hours', ms: 86_400_000, barMs: 30 * 60_000 },
  { id: '7d', label: '7 days', ms: 7 * 86_400_000, barMs: 6 * 3600_000 },
] as const;

const TICK = { fontSize: 12, fill: color.textTertiary };
const CPU_COLOR = chartPalette[0];
const RAM_COLOR = chartPalette[2];

const Tile = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
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
  </Box>
);

/** Records summed into bars by the end of their period. */
function bars(records: UsageRecord[], fromMs: number, toMs: number, barMs: number) {
  const start = Math.floor(fromMs / barMs) * barMs;
  const n = Math.max(1, Math.ceil((toMs - start) / barMs));
  const rows = Array.from({ length: n }, (_, i) => ({ t: start + i * barMs, cpu: 0, ram: 0 }));
  for (const r of records) {
    const i = Math.floor((Date.parse(r.period_end) - start) / barMs);
    if (i < 0 || i >= n) continue;
    rows[i].cpu += r.cpu_s;
    rows[i].ram += r.ram_gib_s;
  }
  return rows;
}

/** One measure over time: a single series, so the title names it and there is no legend. */
const SeriesChart = ({
  title,
  rows,
  dataKey,
  fill,
  unit,
  barMs,
}: {
  title: string;
  rows: ReturnType<typeof bars>;
  dataKey: 'cpu' | 'ram';
  fill: string;
  unit: string;
  barMs: number;
}) => {
  const tick = (t: number) => (barMs >= 3600_000 ? fmtDateTime(t).replace(/:\d\d$/, '') : fmtClock(t).slice(0, 5));
  return (
    <Section title={title}>
      <Box
        role="img"
        aria-label={`${title}, one bar per ${barMs / 60_000} minutes`}
        sx={{ width: '100%', height: 200 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
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
              labelFormatter={(t: number) => `${fmtDateTime(t)} – ${fmtClock(t + barMs)}`}
              formatter={(v) => [`${fmtQty(Number(v))} ${unit}`, title]}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: color.border }}
            />
            <Bar dataKey={dataKey} fill={fill} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Section>
  );
};

/**
 * Usage (`GET /v1/usage/records`, this bucket): the signed records nodes write
 * per sandbox, one per minute plus a final one, with the DAC agent's answer.
 * Quantities are as measured, CPU-seconds and GiB-seconds; there is no price
 * list for sandboxes yet, so nothing here is converted to money.
 */
const Usage = () => {
  const { bucketId } = useCompute();
  const [win, setWin] = useState<(typeof WINDOWS)[number]['id']>('24h');
  const w = WINDOWS.find((x) => x.id === win)!;
  const since = useMemo(() => new Date(Date.now() - w.ms).toISOString(), [w.ms]);
  const { data, error } = useUsageRecords({ since });
  const sandboxes = useSandboxes();
  const records = useMemo(
    () => [...(data?.items ?? [])].sort((a, b) => Date.parse(b.period_end) - Date.parse(a.period_end)),
    [data],
  );
  const total = sumRecords(records);
  const dac = { pushed: 0, pending: 0, failed: 0 };
  for (const r of records) dac[r.dac_status] = (dac[r.dac_status] ?? 0) + 1;
  const rows = bars(records, Date.parse(since), Date.now(), w.barMs);

  const bySandbox = useMemo(() => {
    const m = new Map<string, UsageRecord[]>();
    for (const r of records) m.set(r.sandbox_id, [...(m.get(r.sandbox_id) ?? []), r]);
    const labels = new Map(
      (sandboxes.data?.items ?? []).map((s) => [
        s.id,
        s.labels['cere.agent'] ? `agent ${s.labels['cere.agent']}` : s.image,
      ]),
    );
    return [...m.entries()]
      .map(([id, rs]) => ({
        id,
        label: labels.get(id) ?? '',
        n: rs.length,
        ...sumRecords(rs),
        cpuUnits: sumUnits(rs.map((r) => r.cpu_units)),
        ramUnits: sumUnits(rs.map((r) => r.ram_units)),
      }))
      .sort((a, b) => b.cpu_s - a.cpu_s);
  }, [records, sandboxes.data]);

  return (
    <Box>
      <Box marginBottom="16px">
        <PageHeader
          title="Usage"
          subtitle="What the nodes measured for your sandboxes, from the signed usage records they send to DAC. Sandboxes bill measured CPU and memory."
          actions={<BucketChip bucketId={bucketId} />}
        />
      </Box>

      <Stack direction="row" gap="8px" marginBottom="16px" alignItems="center">
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
        {data?.truncated && <Typography sx={text.caption}>The newest {records.length} records.</Typography>}
      </Stack>

      {error && !data ? (
        <ReadError what="usage records" error={error} />
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <Tile label="CPU-seconds" value={fmtQty(total.cpu_s)} sub="one vCPU busy for one second" />
            <Tile label="GiB-seconds" value={fmtQty(total.ram_gib_s)} sub="one GiB of memory held for one second" />
            <Tile
              label="Usage records"
              value={String(records.length)}
              sub={`${dac.pushed} pushed to DAC · ${dac.pending} pending · ${dac.failed} failed`}
            />
            <Tile
              label="Network"
              value={fmtBytes(total.net_egress_bytes + total.net_ingress_bytes)}
              sub={`out ${fmtBytes(total.net_egress_bytes)} · in ${fmtBytes(total.net_ingress_bytes)} (measured, not billed)`}
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
            <SeriesChart title="CPU-seconds" rows={rows} dataKey="cpu" fill={CPU_COLOR} unit="CPU-s" barMs={w.barMs} />
            <SeriesChart title="GiB-seconds" rows={rows} dataKey="ram" fill={RAM_COLOR} unit="GiB-s" barMs={w.barMs} />
          </Box>

          <Box marginBottom="16px">
            <Section title="By sandbox" flush>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Sandbox</TableCell>
                      <TableCell align="right">Records</TableCell>
                      <TableCell align="right">CPU-s</TableCell>
                      <TableCell align="right">GiB-s</TableCell>
                      <TableCell align="right">DAC cpuUnits</TableCell>
                      <TableCell align="right">DAC ramUnits</TableCell>
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
                            to={`/sandboxes/list/${r.id}`}
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
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {r.n}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmtQty(r.cpu_s)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmtQty(r.ram_gib_s)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ fontVariantNumeric: 'tabular-nums', fontFamily: mono, fontSize: 12 }}
                        >
                          {fmtUnits(r.cpuUnits)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ fontVariantNumeric: 'tabular-nums', fontFamily: mono, fontSize: 12 }}
                        >
                          {fmtUnits(r.ramUnits)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {bySandbox.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ textAlign: 'center', padding: '28px' }}>
                          <Typography sx={text.secondary}>{data ? 'No usage in this window.' : 'Reading…'}</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Section>
          </Box>

          <Section title="Usage records">
            <Typography sx={{ ...text.secondary, marginTop: '-6px', marginBottom: '12px' }}>
              Each record is signed with its node’s key and pushed to that node’s DAC agent, which files it under its
              TCA (the minute it closed). CPU and RAM units are the record’s own fields: seconds × 10¹¹.
            </Typography>
            <RecordsTable
              records={records.slice(0, 200)}
              showSandbox
              empty={data ? 'No records in this window.' : 'Reading…'}
            />
          </Section>
        </>
      )}
    </Box>
  );
};

export default Usage;
