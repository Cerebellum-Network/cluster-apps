import { Fragment, useState } from 'react';
import {
  Box,
  Collapse,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@cluster-apps/ui';
import { KeyboardArrowRight } from '@mui/icons-material';
import { Bar, CartesianGrid, Cell, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ComingSoon, Section } from '~/components';
import {
  compactWords,
  detailSteps,
  fmtCount,
  gpuWords,
  refusedCell,
  stepPhrase,
  type UsageRow,
  type UsageWindow,
} from '~/inference/usageMath';
import { useModelDetail } from '~/inference/useUsage';
import { timeFormat } from './UsageChart';

const AT_LIMIT = '#b4410c';
const FULL = '#f0b98f';
const PEAK = '#c7b3f3';
const REFUSED_COLOR = { none: 'text.disabled', limit: AT_LIMIT, full: 'text.secondary' } as const;

function PeakCell({ row }: { row: UsageRow }) {
  const ratio = row.limit ? row.peak / row.limit : 0;
  const full = row.limit !== null && row.peak >= row.limit;
  return (
    <Stack direction="row" alignItems="center" gap="8px">
      <Box aria-hidden sx={{ width: 56, height: 6, backgroundColor: '#f1eef8', borderRadius: '3px', overflow: 'hidden', flexShrink: 0 }}>
        <Box sx={{ height: '100%', width: `${Math.min(1, ratio) * 100}%`, backgroundColor: full ? AT_LIMIT : 'primary.main' }} />
      </Box>
      <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', color: full ? AT_LIMIT : undefined, fontWeight: full ? 600 : 400 }}>
        {row.limit ? `${fmtCount(row.peak)} / ${fmtCount(row.limit)}` : fmtCount(row.peak)}
      </Box>
    </Stack>
  );
}

function Stat({ label, value, share, color }: { label: string; value: string; share?: number; color: string }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" gap="8px" sx={{ fontSize: 13 }}>
        <Box component="span" sx={{ color: 'text.secondary' }}>{label}</Box>
        <Box component="b" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</Box>
      </Stack>
      {share !== undefined && (
        <Box aria-hidden sx={{ height: 5, marginTop: '4px', backgroundColor: '#efeaf8', borderRadius: '3px', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${Math.min(100, share * 100)}%`, backgroundColor: color }} />
        </Box>
      )}
    </Box>
  );
}

const caption = { fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: 'text.secondary', textTransform: 'uppercase' } as const;

/** Tokens in / cached / out, or a "Coming soon" where the gateway doesn't count them. */
function TokenStats({ row, tokensAvailable }: { row: UsageRow; tokensAvailable: boolean }) {
  const per = (v: number, d: number, digits = 2) => (d > 0 ? (v / d).toFixed(digits) : '—');
  const all = row.tokensIn + row.tokensOut;
  const share = (v: number) => (all > 0 ? v / all : 0);
  return (
    <Stack gap="10px" sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" gap="8px">
        <Typography sx={caption}>Tokens</Typography>
        {!tokensAvailable && <ComingSoon />}
      </Stack>
      {tokensAvailable && all > 0 ? (
        <>
          <Stat label="In" value={compactWords(row.tokensIn)} share={share(row.tokensIn)} color="#b294f0" />
          <Stat label="of which cached" value={compactWords(row.tokensCached)} share={share(row.tokensCached)} color="#c9b6f5" />
          <Stat label="Out" value={compactWords(row.tokensOut)} share={share(row.tokensOut)} color="#5b2bc9" />
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {tokensAvailable ? 'This model doesn’t count tokens.' : 'Token counts per model are on the way.'}
        </Typography>
      )}
      <Stat label="GPU units per request" value={per(row.gpu, row.requests)} color="#5b2bc9" />
    </Stack>
  );
}

function InflightPlot({ gatewayKey, row, window: w, onAuthError }: { gatewayKey: string; row: UsageRow; window: UsageWindow; onAuthError: () => void }) {
  const detail = useModelDetail(gatewayKey, row.model, w, onAuthError);
  if (detail.kind === 'loading') {
    return <Typography variant="body2" color="text.secondary">Loading…</Typography>;
  }
  if (detail.kind === 'error') {
    return (
      <Typography variant="body2" color="error" title={detail.detail}>
        {detail.message}
      </Typography>
    );
  }
  const steps = detailSteps(detail.data.peak, detail.data.refused, w);
  const time = timeFormat(w.barMs);
  const tick = { fontSize: 10.5, fill: '#6B6A7B' };
  const limit = row.limit;
  const top = Math.max(limit ?? 0, ...steps.map((s) => s.peak ?? 0));
  const refusedAny = steps.some((s) => s.refusedLimit + s.refusedFull > 0);
  return (
    <>
      <Box role="img" aria-label={`Peak in flight per ${stepPhrase(w.barMs)} for ${row.model}`} sx={{ height: 170 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={steps} margin={{ top: 6, right: refusedAny ? 0 : 8, bottom: 0, left: 0 }} barGap={0} barCategoryGap={steps.length > 60 ? 0 : '10%'}>
            <CartesianGrid vertical={false} stroke="#EEEFF5" />
            <XAxis dataKey="t" tickFormatter={time.tick} minTickGap={24} tick={tick} tickLine={false} />
            <YAxis yAxisId="slots" width={32} allowDecimals={false} domain={[0, Math.ceil(top * 1.2) || 1]} tick={tick} tickLine={false} axisLine={false} />
            <YAxis yAxisId="refused" orientation="right" width={refusedAny ? 32 : 0} hide={!refusedAny} allowDecimals={false} tick={{ ...tick, fill: AT_LIMIT }} tickLine={false} axisLine={false} />
            <Tooltip
              labelFormatter={(t: number) => time.full(t)}
              formatter={(v) => (typeof v === 'number' ? fmtCount(v) : '—')}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar yAxisId="slots" dataKey="peak" name="Peak in flight" isAnimationActive={false}>
              {steps.map((s) => (
                <Cell key={s.t} fill={limit && (s.peak ?? 0) >= limit ? AT_LIMIT : PEAK} />
              ))}
            </Bar>
            {refusedAny && <Bar yAxisId="refused" dataKey="refusedLimit" name="Refused, your limit" stackId="r" fill={AT_LIMIT} fillOpacity={0.55} maxBarSize={6} isAnimationActive={false} />}
            {refusedAny && <Bar yAxisId="refused" dataKey="refusedFull" name="Refused, model full" stackId="r" fill={FULL} maxBarSize={6} isAnimationActive={false} />}
            {limit !== null && <ReferenceLine yAxisId="slots" y={limit} stroke="#1B1A27" strokeDasharray="4 3" strokeWidth={2} ifOverflow="extendDomain" />}
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
      <Stack direction="row" flexWrap="wrap" gap="6px 14px" sx={{ fontSize: 11.5, color: 'text.secondary' }}>
        <Legend swatch={PEAK}>Peak</Legend>
        <Legend swatch={AT_LIMIT}>At the limit</Legend>
        <Stack direction="row" alignItems="center" gap="5px">
          <Box component="span" sx={{ width: 14, borderTop: '2px dashed #1B1A27' }} />
          Limit
        </Stack>
        <Legend swatch={AT_LIMIT}>{`Refused, your limit: ${fmtCount(row.refusedLimit)}`}</Legend>
        <Legend swatch={FULL}>{`Refused, model full: ${fmtCount(row.refusedFull)}`}</Legend>
      </Stack>
    </>
  );
}

const Legend = ({ swatch, children }: { swatch: string; children: string }) => (
  <Stack direction="row" alignItems="center" gap="5px">
    <Box component="span" sx={{ width: 9, height: 9, backgroundColor: swatch }} />
    {children}
  </Stack>
);

function Details({ row, gatewayKey, window: w, tokensAvailable, onAuthError }: {
  row: UsageRow;
  gatewayKey: string;
  window: UsageWindow;
  tokensAvailable: boolean;
  onAuthError: () => void;
}) {
  return (
    <Box
      role="region"
      aria-label={`Details for ${row.model}`}
      sx={{
        margin: '0 16px 14px 56px',
        border: '1px solid #E3E4EE',
        borderRadius: '12px',
        backgroundColor: '#fbfaff',
        padding: '14px 16px',
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '220px minmax(0, 1fr)' },
        gap: '20px',
      }}
    >
      <TokenStats row={row} tokensAvailable={tokensAvailable} />
      <Stack component="figure" gap="6px" sx={{ margin: 0, minWidth: 0 }}>
        <Typography component="figcaption" sx={caption}>
          {`In flight against the limit${row.limit ? ` (${fmtCount(row.limit)})` : ', none set'} · peak per ${stepPhrase(w.barMs)}`}
        </Typography>
        <InflightPlot gatewayKey={gatewayKey} row={row} window={w} onAuthError={onAuthError} />
      </Stack>
    </Box>
  );
}

/** Every model this account used in the period, one row each; the arrow opens a row's details. */
const UsageModelsTable = ({ rows, colorOf, gatewayKey, window: w, tokensAvailable, onAuthError }: {
  rows: UsageRow[];
  colorOf: (model: string) => string;
  gatewayKey: string;
  window: UsageWindow;
  tokensAvailable: boolean;
  onAuthError: () => void;
}) => {
  const [open, setOpen] = useState<string[]>([]);
  const toggle = (m: string) => setOpen((o) => (o.includes(m) ? o.filter((x) => x !== m) : [...o, m]));
  const totalGpu = rows.reduce((n, r) => n + r.gpu, 0);
  return (
    <Section title="Models" flush>
      <TableContainer>
        <Table size="small" sx={{ minWidth: 820 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }} />
              <TableCell>Model</TableCell>
              <TableCell align="right">Requests</TableCell>
              <TableCell align="right">GPU units</TableCell>
              <TableCell>Share</TableCell>
              <TableCell>Peak in flight / limit</TableCell>
              <TableCell>Refused</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const isOpen = open.includes(row.model);
              const share = totalGpu > 0 ? row.gpu / totalGpu : 0;
              const refused = refusedCell(row);
              return (
                <Fragment key={row.model}>
                  <TableRow hover sx={{ '& td': { borderBottom: isOpen ? 'none' : undefined } }}>
                    <TableCell sx={{ paddingRight: 0 }}>
                      <IconButton
                        size="small"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? 'Hide' : 'Show'} details for ${row.model}`}
                        onClick={() => toggle(row.model)}
                      >
                        <KeyboardArrowRight sx={{ fontSize: 20, transition: 'transform 150ms', transform: isOpen ? 'rotate(90deg)' : 'none' }} />
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap="8px">
                        <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: colorOf(row.model), flexShrink: 0 }} />
                        <Typography variant="subtitle2">{row.model}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCount(row.requests)}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{gpuWords(row.gpu)}</TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap="8px">
                        <Box aria-hidden sx={{ width: 40, height: 6, backgroundColor: '#f1eef8', borderRadius: '3px', overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${Math.max(2, share * 100)}%`, backgroundColor: '#9b7be8' }} />
                        </Box>
                        <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{`${(share * 100).toFixed(1)}%`}</Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <PeakCell row={row} />
                    </TableCell>
                    <TableCell sx={{ color: REFUSED_COLOR[refused.tone], fontWeight: refused.tone === 'none' ? 400 : 600 }}>{refused.text}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ padding: 0, borderBottom: isOpen ? undefined : 'none' }}>
                      <Collapse in={isOpen} unmountOnExit>
                        <Details row={row} gatewayKey={gatewayKey} window={w} tokensAvailable={tokensAvailable} onAuthError={onAuthError} />
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Section>
  );
};

export default UsageModelsTable;
