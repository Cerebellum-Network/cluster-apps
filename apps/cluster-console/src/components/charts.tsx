import { useMemo, type ReactNode } from 'react';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { DACEra } from '~/api/types';

import { color, Disclosure, text } from './ui';

/**
 * Chart colours. Two series take slots 1 and 3 of the app's chart palette
 * (developer console tokens): purple and teal, validated on white with the
 * dataviz validator (CVD ΔE 24.9, normal-vision ΔE 32.0, both ≥ 3:1 contrast).
 * One series uses slot 1. Status colours are kept for states only.
 */
export const SERIES = { billed: '#5b2bc9', measured: '#1f9e8f', one: '#5b2bc9' } as const;

const HOUR = 3_600_000;
const TICK = { fontSize: 12, fill: color.textTertiary };

function timeFormats(starts: number[], stepMs: number) {
  const full = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const multiDay = starts.length * stepMs > 36 * HOUR;
  if (!multiDay) {
    const clock = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return {
      tick: (t: number) => clock.format(t),
      full: (t: number) => full.format(t),
      ticks: undefined as number[] | undefined,
    };
  }
  const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const dayOf = (t: number) => new Date(t).toDateString();
  const firsts = starts.filter((t, i) => i > 0 && dayOf(t) !== dayOf(starts[i - 1]));
  return {
    tick: (t: number) => date.format(t),
    full: (t: number) => full.format(t),
    ticks: firsts.length >= 2 ? firsts : undefined,
  };
}

export interface TimeSeries {
  key: string;
  label: string;
  color: string;
  /** null is a gap (no reading), never a zero. */
  values: (number | null)[];
  /** The series' total over the window, as the legend shows it. */
  total: string;
}

/**
 * Change over time: one line per series on one axis (never two scales),
 * a crosshair tooltip listing every series, a legend with each total, and a
 * table view of the same points.
 */
export function TimeChart({
  starts,
  stepMs,
  series,
  format,
  axis,
  label,
  height = 200,
  tableLabel = 'Hour',
}: {
  starts: number[];
  stepMs: number;
  series: TimeSeries[];
  /** A value as the tooltip and table show it. */
  format: (v: number) => string;
  /** A value as the y-axis shows it. */
  axis: (v: number) => string;
  /** What the chart shows, for screen readers. */
  label: string;
  height?: number;
  /** The first column of the table view. */
  tableLabel?: string;
}) {
  const rows = useMemo(
    () => starts.map((t, i) => ({ t, ...Object.fromEntries(series.map((s) => [s.key, s.values[i] ?? null])) })),
    [starts, series],
  );
  const fmt = timeFormats(starts, stepMs);
  const empty = series.every((s) => s.values.every((v) => !v));
  const show = (v: unknown) => (v === null || v === undefined ? 'not recorded' : format(Number(v)));
  return (
    <Box>
      <Box role="img" aria-label={label} sx={{ width: '100%', height: height + 28 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={color.grid} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={fmt.tick}
              ticks={fmt.ticks}
              minTickGap={28}
              tick={TICK}
              tickLine={false}
              stroke={color.border}
            />
            <YAxis width={48} tickFormatter={axis} tick={TICK} tickLine={false} axisLine={false} allowDecimals />
            <Tooltip
              cursor={{ stroke: color.textTertiary, strokeWidth: 1 }}
              content={({ active, payload, label: t }) =>
                active && payload?.length ? (
                  <Box
                    sx={{
                      backgroundColor: color.surface,
                      border: `1px solid ${color.border}`,
                      borderRadius: '8px',
                      padding: '8px 10px',
                      boxShadow: '0 4px 14px rgba(29,27,32,0.08)',
                    }}
                  >
                    <Typography sx={{ ...text.caption, marginBottom: '4px' }}>{fmt.full(Number(t))}</Typography>
                    {series.map((s) => {
                      const p = payload.find((x) => x.dataKey === s.key);
                      return (
                        <Stack key={s.key} direction="row" spacing={1} alignItems="center">
                          <Box aria-hidden sx={{ width: 12, height: 2, borderRadius: 1, backgroundColor: s.color }} />
                          <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {show(p?.value)}
                          </Typography>
                          <Typography sx={{ fontSize: 12.5, color: color.textSecondary }}>{s.label}</Typography>
                        </Stack>
                      );
                    })}
                  </Box>
                ) : null
              }
            />
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="linear"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                connectNulls={false}
                activeDot={{ r: 4, stroke: color.surface, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <Stack direction="row" flexWrap="wrap" useFlexGap gap="6px 20px" alignItems="center" sx={{ marginTop: 1 }}>
        {series.map((s) => (
          <Stack key={s.key} direction="row" spacing={0.75} alignItems="center">
            <Box aria-hidden sx={{ width: 14, height: 2, borderRadius: 1, backgroundColor: s.color }} />
            <Typography sx={{ fontSize: 13, color: color.textSecondary }}>{s.label}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{s.total}</Typography>
          </Stack>
        ))}
        {empty && <Typography sx={{ ...text.caption }}>Nothing in this period.</Typography>}
        <Box sx={{ marginLeft: 'auto' }}>
          <Disclosure label="Show as table">
            <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
              <Table
                size="small"
                sx={{ '& td, & th': { fontSize: 12.5, padding: '4px 10px', fontVariantNumeric: 'tabular-nums' } }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>{tableLabel}</TableCell>
                    {series.map((s) => (
                      <TableCell key={s.key} align="right">
                        {s.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.t}>
                      <TableCell>{fmt.full(r.t)}</TableCell>
                      {series.map((s) => (
                        <TableCell key={s.key} align="right">
                          {show((r as Record<string, number | null>)[s.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Disclosure>
        </Box>
      </Stack>
    </Box>
  );
}

export interface RankedRow {
  key: string;
  label: ReactNode;
  /** A short line under the label. */
  sub?: ReactNode;
  value: number;
  /** The value as text, at the bar's end. */
  display: string;
  /** Text for hover and screen readers. */
  title: string;
}

/** Magnitude, largest first: one hue, a square baseline and a 4px rounded data end. */
export function RankedBars({ rows, empty, max }: { rows: RankedRow[]; empty?: ReactNode; max?: number }) {
  const top = max ?? Math.max(0, ...rows.map((r) => r.value));
  if (rows.length === 0)
    return <Typography sx={{ ...text.secondary }}>{empty ?? 'Nothing in this period.'}</Typography>;
  return (
    <Stack component="ol" sx={{ listStyle: 'none', margin: 0, padding: 0 }} spacing={1.5}>
      {rows.map((r) => (
        <Box component="li" key={r.key} title={r.title} aria-label={r.title}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
            <Box minWidth={0}>
              <Typography
                component="div"
                sx={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.label}
              </Typography>
              {r.sub && (
                <Typography component="div" sx={{ ...text.caption }}>
                  {r.sub}
                </Typography>
              )}
            </Box>
            <Typography
              sx={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
            >
              {r.display}
            </Typography>
          </Stack>
          <Box sx={{ marginTop: '6px', height: 10, backgroundColor: color.grid, borderRadius: '0 4px 4px 0' }}>
            <Box
              sx={{
                height: '100%',
                width: top > 0 ? `${(100 * r.value) / top}%` : 0,
                minWidth: r.value > 0 ? 3 : 0,
                backgroundColor: SERIES.one,
                borderRadius: '0 4px 4px 0',
              }}
            />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

/** DAC era statuses as a manager reads them, with their status colour. */
export const ERA_STATE: Record<string, { label: string; fill: string }> = {
  ERA_PAID: { label: 'Paid', fill: color.success },
  ERA_PROCESSED: { label: 'Sealed', fill: '#6F9F80' },
  ERA_INSPECTED: { label: 'Sealed', fill: '#6F9F80' },
  ERA_IN_PROGRESS: { label: 'In progress', fill: color.primary },
  ERA_EMPTY: { label: 'Empty', fill: '#C9CBD8' },
  ERA_FORCED_SKIPPED: { label: 'Skipped', fill: color.warning },
};

const eraState = (s: string) => ERA_STATE[s] ?? { label: s, fill: color.textTertiary };

/**
 * One cell per DAC era, coloured by its status, one row per UTC day. It
 * answers "is DAC verifying our work" at a glance; a cell's title gives the
 * era, its times and status.
 */
export function EraStrip({
  eras,
  onPick,
  compact,
}: {
  eras: DACEra[];
  onPick?: (e: DACEra) => void;
  compact?: boolean;
}) {
  const { days, slots, counts } = useMemo(() => {
    const lens = eras
      .map((e) => Date.parse(e.end) - Date.parse(e.start))
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    const eraMs = lens.length ? lens[Math.floor(lens.length / 2)] : HOUR;
    const perDay = Math.max(1, Math.round(86_400_000 / eraMs));
    const byDay = new Map<string, (DACEra | null)[]>();
    const c = new Map<string, number>();
    for (const e of eras) {
      const t = Date.parse(e.start);
      const day = e.start.slice(0, 10);
      const slot = Math.min(perDay - 1, Math.floor((t - Date.parse(`${day}T00:00:00Z`)) / eraMs));
      if (!byDay.has(day)) byDay.set(day, Array(perDay).fill(null));
      byDay.get(day)![slot] = e;
      const l = eraState(e.status).label;
      c.set(l, (c.get(l) ?? 0) + 1);
    }
    return { days: [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])), slots: perDay, counts: c };
  }, [eras]);
  const fmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  if (eras.length === 0) return <Typography sx={text.secondary}>DAC lists no era in this period.</Typography>;
  return (
    <Box>
      <Stack spacing="4px">
        {days.map(([day, cells]) => (
          <Stack key={day} direction="row" alignItems="center" spacing={1.5}>
            {!compact && (
              <Typography sx={{ ...text.caption, width: 48, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {dayFmt.format(Date.parse(`${day}T12:00:00Z`))}
              </Typography>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))`, gap: '2px', flex: 1 }}>
              {cells.map((e, i) =>
                e ? (
                  <Box
                    key={i}
                    component={onPick ? 'button' : 'span'}
                    onClick={onPick ? () => onPick(e) : undefined}
                    title={`Era ${e.id} · ${fmt.format(Date.parse(e.start))}–${fmt.format(Date.parse(e.end)).replace(/^.*, /, '')} · ${eraState(e.status).label}`}
                    aria-label={`Era ${e.id}, ${eraState(e.status).label}`}
                    sx={{
                      display: 'block',
                      height: compact ? 14 : 18,
                      border: 0,
                      padding: 0,
                      borderRadius: '2px',
                      backgroundColor: eraState(e.status).fill,
                      cursor: onPick ? 'pointer' : 'default',
                      '&:hover': { opacity: 0.75 },
                    }}
                  />
                ) : (
                  <Box key={i} sx={{ height: compact ? 14 : 18, borderRadius: '2px', backgroundColor: color.grid }} />
                ),
              )}
            </Box>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" flexWrap="wrap" useFlexGap gap="4px 16px" sx={{ marginTop: 1.25 }}>
        {[...counts.entries()].map(([l, n]) => {
          const fill = Object.values(ERA_STATE).find((s) => s.label === l)?.fill ?? color.textTertiary;
          return (
            <Stack key={l} direction="row" spacing={0.75} alignItems="center">
              <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: fill }} />
              <Typography sx={{ fontSize: 12.5, color: color.textSecondary }}>
                {l} <b style={{ color: color.text }}>{n}</b>
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

/**
 * A service's use of a shared machine: the machine's total, the service's
 * quota within it, and what the service uses. The bar spans the total; the
 * quota is a lighter band with an edge marker; use fills from the left. A
 * missing total or quota is said, not drawn.
 */
export function QuotaBar({
  total,
  quota,
  used,
  format,
  quotaMissing,
  totalMissing,
  totalLabel = 'on the machine',
}: {
  /** How the total is named after its figure: "on the machine", "of GPU memory". */
  totalLabel?: string;
  total: number | null;
  quota: number | null;
  used: number | null;
  format: (v: number) => string;
  /** Why there is no quota, when there is none. */
  quotaMissing?: string;
  totalMissing?: string;
}) {
  const span = total ?? quota ?? used ?? 0;
  const pct = (v: number | null) => (v !== null && span > 0 ? `${Math.min(100, (100 * v) / span)}%` : '0%');
  const share = (a: number | null, b: number | null) => (a !== null && b ? `${Math.round((100 * a) / b)}%` : null);
  const ofQuota = share(used, quota);
  const ofTotal = share(used, total);
  return (
    <Box>
      <Box
        sx={{
          position: 'relative',
          height: 10,
          borderRadius: '4px',
          backgroundColor: total !== null ? color.grid : 'transparent',
          border: total === null ? `1px dashed ${color.border}` : 'none',
        }}
      >
        {quota !== null && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              width: pct(quota),
              backgroundColor: color.primaryTint,
              borderRadius: '4px',
              borderRight: `2px solid ${color.primary}`,
            }}
          />
        )}
        {used !== null && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: pct(used),
              minWidth: used > 0 ? 3 : 0,
              backgroundColor: color.primary,
              borderRadius: '4px',
            }}
          />
        )}
      </Box>
      <Typography component="div" sx={{ ...text.caption, marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
        {used !== null ? <b style={{ color: color.text }}>{format(used)}</b> : '—'} used
        {quota !== null ? (
          <>
            {' '}
            of {format(quota)} quota{ofQuota ? ` (${ofQuota})` : ''}
          </>
        ) : (
          <span title={quotaMissing}> · quota not available</span>
        )}
        {total !== null ? (
          <>
            {' '}
            · {format(total)} {totalLabel}
            {ofTotal ? ` (${ofTotal})` : ''}
          </>
        ) : (
          <span title={totalMissing}> · machine total not available</span>
        )}
      </Typography>
    </Box>
  );
}
