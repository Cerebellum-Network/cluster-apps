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
import { alpha } from '@mui/material';
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
import { color, text } from '~/theme/tokens';
import { TICK, timeAxis } from './UsageChart';

const AT_LIMIT = color.warning;
const FULL = color.warningSoft;
const REFUSED_COLOR = { none: color.textTertiary, limit: AT_LIMIT, full: color.textSecondary } as const;

/** Evenly spaced integer ticks from 0 to just above `top` (so a limit line never sits on the frame). */
export function evenTicks(top: number): number[] {
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => top / s <= 5) ?? Math.ceil(top / 5);
  const max = Math.max(step, Math.floor(top / step) * step + step);
  return Array.from({ length: max / step + 1 }, (_, i) => i * step);
}

/** A pill that applies a filter when clicked; tinted while that filter is on. */
export function FilterPill({ label, active, onClick, title }: { label: string; active: boolean; onClick: () => void; title: string }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      sx={{
        all: 'unset',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 8px',
        borderRadius: '999px',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: active ? color.primaryDark : color.textSecondary,
        backgroundColor: active ? color.primaryTint : color.neutralFill,
        '&:hover': { backgroundColor: color.primaryTint, color: color.primaryDark },
        '&:focus-visible': { outline: `2px solid ${color.primary}`, outlineOffset: 2 },
      }}
    >
      {label}
    </Box>
  );
}

function PeakCell({ row }: { row: UsageRow }) {
  const ratio = row.limit ? row.peak / row.limit : 0;
  const full = row.limit !== null && row.peak >= row.limit;
  return (
    <Stack direction="row" alignItems="center" gap="8px">
      <Box aria-hidden sx={{ width: 56, height: 6, backgroundColor: color.grid, borderRadius: '3px', overflow: 'hidden', flexShrink: 0 }}>
        <Box sx={{ height: '100%', width: `${Math.min(1, ratio) * 100}%`, backgroundColor: full ? AT_LIMIT : 'primary.main' }} />
      </Box>
      <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', color: full ? AT_LIMIT : undefined, fontWeight: full ? 600 : 400 }}>
        {row.limit ? `${fmtCount(row.peak)} / ${fmtCount(row.limit)}` : fmtCount(row.peak)}
      </Box>
    </Stack>
  );
}

function Stat({ label, value, share, fill }: { label: string; value: string; share?: number; fill: string }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" gap="8px" sx={{ fontSize: 13 }}>
        <Box component="span" sx={{ color: 'text.secondary' }}>{label}</Box>
        <Box component="b" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</Box>
      </Stack>
      {share !== undefined && (
        <Box aria-hidden sx={{ height: 5, marginTop: '4px', backgroundColor: color.grid, borderRadius: '3px', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${Math.min(100, share * 100)}%`, backgroundColor: fill }} />
        </Box>
      )}
    </Box>
  );
}

const caption = text.label;

/**
 * Tokens in / cached / out. A zero is "—", never "doesn't count tokens": the
 * gateway's counters can read zero for a model that does count them (see
 * usageMath.ts on VictoriaMetrics' first sample). "Coming soon" only when the
 * gateway won't serve token counts at all.
 */
function TokenStats({ row, tokensAvailable }: { row: UsageRow; tokensAvailable: boolean }) {
  const per = (v: number, d: number, digits = 2) => (d > 0 ? (v / d).toFixed(digits) : '—');
  const all = row.tokensIn + row.tokensOut;
  const share = (v: number) => (all > 0 ? v / all : 0);
  const cell = (v: number) => (v > 0 ? compactWords(v) : '—');
  return (
    <Stack gap="10px" sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" gap="8px">
        <Typography sx={caption}>Tokens</Typography>
        {!tokensAvailable && <ComingSoon />}
      </Stack>
      {tokensAvailable && (
        <>
          <Stat label="In" value={cell(row.tokensIn)} share={share(row.tokensIn)} fill={color.primary} />
          <Stat label="of which cached" value={cell(row.tokensCached)} share={share(row.tokensCached)} fill={alpha(color.primary, 0.4)} />
          <Stat label="Out" value={cell(row.tokensOut)} share={share(row.tokensOut)} fill={color.primaryDark} />
        </>
      )}
      <Stat label="GPU units per request" value={per(row.gpu, row.requests)} fill={color.primary} />
    </Stack>
  );
}

function InflightPlot({ gatewayKey, row, window: w, onAuthError }: { gatewayKey: string; row: UsageRow; window: UsageWindow; onAuthError: () => void }) {
  const detail = useModelDetail(gatewayKey, row.model, w, onAuthError);
  if (detail.kind === 'loading') {
    return <Typography sx={text.secondary}>Loading…</Typography>;
  }
  if (detail.kind === 'error') {
    return (
      <Typography sx={{ fontSize: 13, color: 'error.main' }} title={detail.detail}>
        {detail.message}
      </Typography>
    );
  }
  const steps = detailSteps(detail.data.peak, detail.data.refused, w);
  const time = timeAxis(steps.map((s) => s.t), w.barMs);
  const limit = row.limit;
  const slotTicks = evenTicks(Math.max(limit ?? 0, ...steps.map((s) => s.peak ?? 0), 1));
  const refusedTop = Math.max(...steps.map((s) => s.refusedLimit + s.refusedFull), 0);
  const refusedAny = refusedTop > 0;
  const refusedTicks = refusedAny ? [0, evenTicks(refusedTop).slice(-1)[0]] : [0];
  const sync = `inflight-${row.model}`;
  const margin = { top: 6, right: 8, bottom: 0, left: 0 };
  const gap = steps.length > 60 ? 0 : '10%';
  const xAxis = (hide: boolean) => (
    <XAxis dataKey="t" hide={hide} tickFormatter={time.tick} ticks={time.ticks} interval={time.ticks ? 0 : 'preserveEnd'} minTickGap={24} tick={TICK} tickLine={false} stroke={color.border} />
  );
  const tooltip = (
    <Tooltip
      labelFormatter={(t: number) => time.full(t)}
      formatter={(v) => (typeof v === 'number' ? fmtCount(v) : '—')}
      contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: color.border }}
    />
  );
  return (
    <>
      {/* Peak in flight against the limit: one axis, even integer ticks. */}
      <Box role="img" aria-label={`Peak in flight per ${stepPhrase(w.barMs)} for ${row.model}`} sx={{ height: refusedAny ? 130 : 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={steps} syncId={sync} margin={{ ...margin, bottom: refusedAny ? 8 : 0 }} barCategoryGap={gap}>
            <CartesianGrid vertical={false} stroke={color.grid} />
            {xAxis(refusedAny)}
            <YAxis width={36} domain={[0, slotTicks[slotTicks.length - 1]]} ticks={slotTicks} interval={0} tick={TICK} tickLine={false} axisLine={false} />
            {tooltip}
            <Bar dataKey="peak" name="Peak in flight" isAnimationActive={false}>
              {steps.map((s) => (
                <Cell key={s.t} fill={limit && (s.peak ?? 0) >= limit ? AT_LIMIT : color.primary} fillOpacity={limit && (s.peak ?? 0) >= limit ? 1 : 0.35} />
              ))}
            </Bar>
            {limit !== null && <ReferenceLine y={limit} stroke={color.text} strokeDasharray="4 3" strokeWidth={1.5} />}
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
      {/* Refusals on their own strip and axis, under the same time axis, so they never cover a peak. */}
      {refusedAny && (
        <>
          <Typography sx={{ ...text.caption, color: color.textTertiary, margin: '6px 0 0 36px' }}>Refused per {stepPhrase(w.barMs)}</Typography>
          <Box role="img" aria-label={`Requests refused per ${stepPhrase(w.barMs)} for ${row.model}`} sx={{ height: 76 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={steps} syncId={sync} margin={margin} barCategoryGap={gap}>
                <CartesianGrid vertical={false} stroke={color.grid} />
                {xAxis(false)}
                <YAxis width={36} domain={[0, refusedTicks[1]]} ticks={refusedTicks} interval={0} tick={TICK} tickLine={false} axisLine={false} />
                {tooltip}
                <Bar dataKey="refusedLimit" name="Refused, your limit" stackId="r" fill={AT_LIMIT} isAnimationActive={false} />
                <Bar dataKey="refusedFull" name="Refused, model full" stackId="r" fill={FULL} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        </>
      )}
      <Stack direction="row" flexWrap="wrap" gap="6px 14px" sx={{ ...text.caption, marginTop: '4px' }}>
        <Legend swatch={color.primary} opacity={0.35}>Peak</Legend>
        <Legend swatch={AT_LIMIT}>At the limit</Legend>
        {limit !== null && (
          <Stack direction="row" alignItems="center" gap="5px">
            <Box component="span" sx={{ width: 14, borderTop: `2px dashed ${color.text}` }} />
            Limit
          </Stack>
        )}
        {refusedAny && <Legend swatch={AT_LIMIT}>{`Refused, your limit: ${fmtCount(row.refusedLimit)}`}</Legend>}
        {refusedAny && <Legend swatch={FULL}>{`Refused, model full: ${fmtCount(row.refusedFull)}`}</Legend>}
      </Stack>
    </>
  );
}

const Legend = ({ swatch, opacity = 1, children }: { swatch: string; opacity?: number; children: string }) => (
  <Stack direction="row" alignItems="center" gap="5px">
    <Box component="span" sx={{ width: 9, height: 9, borderRadius: '2px', backgroundColor: swatch, opacity }} />
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
        border: `1px solid ${color.border}`,
        borderRadius: '12px',
        backgroundColor: color.inset,
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

/**
 * Every model this account used in the period, one row each, whatever the
 * filters: out-of-view rows are greyed. A model's name and its type each
 * toggle their filter; the arrow opens its details.
 */
const UsageModelsTable = ({ rows, colorOf, isInView, selected, onPickModel, kindOf, selectedKinds, onPickKind, gatewayKey, window: w, tokensAvailable, onAuthError }: {
  rows: UsageRow[];
  colorOf: (model: string) => string;
  /** Rows out of view (filtered away) stay listed, greyed. */
  isInView: (model: string) => boolean;
  /** Models the page is filtered to. */
  selected: string[];
  /** A model name toggles its filter. */
  onPickModel: (model: string) => void;
  /** A model's type ("Chat", "Speech to text", …) from the catalogue. */
  kindOf: (model: string) => string;
  /** Types the page is filtered to. */
  selectedKinds: string[];
  /** A type pill toggles its filter. */
  onPickKind: (kind: string) => void;
  gatewayKey: string;
  window: UsageWindow;
  tokensAvailable: boolean;
  onAuthError: () => void;
}) => {
  const [open, setOpen] = useState<string[]>([]);
  const toggle = (m: string) => setOpen((o) => (o.includes(m) ? o.filter((x) => x !== m) : [...o, m]));
  // Share of the models in view, as the tiles count them; a filtered-away row has none.
  const totalGpu = rows.reduce((n, r) => (isInView(r.model) ? n + r.gpu : n), 0);
  return (
    <Section title="Models" flush>
      <TableContainer>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }} />
              <TableCell>Model</TableCell>
              <TableCell>Type</TableCell>
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
              const share = !isInView(row.model) ? null : totalGpu > 0 ? row.gpu / totalGpu : 0;
              const refused = refusedCell(row);
              return (
                <Fragment key={row.model}>
                  <TableRow
                    hover
                    selected={selected.includes(row.model)}
                    sx={{ '& td': { borderBottom: isOpen ? 'none' : undefined, fontSize: 14 }, opacity: isInView(row.model) ? 1 : 0.45 }}
                  >
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
                        <Box
                          component="button"
                          type="button"
                          onClick={() => onPickModel(row.model)}
                          title={selected.includes(row.model) ? `Remove ${row.model} from the filter` : `Filter to ${row.model}`}
                          sx={{
                            all: 'unset',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 600,
                            color: selected.includes(row.model) ? color.primary : color.text,
                            '&:hover': { textDecoration: 'underline' },
                            '&:focus-visible': { outline: `2px solid ${color.primary}`, outlineOffset: 2 },
                          }}
                        >
                          {row.model}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <FilterPill
                        label={kindOf(row.model)}
                        active={selectedKinds.includes(kindOf(row.model))}
                        onClick={() => onPickKind(kindOf(row.model))}
                        title={selectedKinds.includes(kindOf(row.model)) ? `Remove ${kindOf(row.model)} from the filter` : `Filter to ${kindOf(row.model)}`}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCount(row.requests)}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{gpuWords(row.gpu)}</TableCell>
                    <TableCell>
                      {share === null ? (
                        <Box component="span" sx={{ color: color.textTertiary }}>—</Box>
                      ) : (
                        <Stack direction="row" alignItems="center" gap="8px">
                          <Box aria-hidden sx={{ width: 40, height: 6, backgroundColor: color.grid, borderRadius: '3px', overflow: 'hidden' }}>
                            <Box sx={{ height: '100%', width: `${Math.max(2, share * 100)}%`, backgroundColor: color.primary }} />
                          </Box>
                          <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{`${(share * 100).toFixed(1)}%`}</Box>
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell>
                      <PeakCell row={row} />
                    </TableCell>
                    <TableCell sx={{ color: REFUSED_COLOR[refused.tone], fontWeight: refused.tone === 'none' ? 400 : 600 }}>{refused.text}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={8} sx={{ padding: 0, borderBottom: isOpen ? undefined : 'none' }}>
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
