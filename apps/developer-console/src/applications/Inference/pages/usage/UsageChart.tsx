import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Section } from '~/components';
import { compactWords, type StackSeries } from '~/inference/usageMath';
import { color, text } from '~/theme/tokens';

const HOUR = 3_600_000;

/**
 * The time axis for bars keyed by their end time. Up to a day and a half the
 * ticks are clock times; longer windows tick once per local day (the first bar
 * of each day) and label it with the date, at most ~8 labels, so a 7-day chart
 * reads as days, not as a run of anonymous hours.
 */
export function timeAxis(startsMs: number[], barMs: number): {
  tick: (t: number) => string;
  full: (t: number) => string;
  /** Explicit tick positions, or undefined to let the chart choose. */
  ticks?: number[];
} {
  const full = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const multiDay = startsMs.length * barMs > 36 * HOUR;
  if (!multiDay) {
    const clock = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return { tick: (t) => clock.format(t), full: (t) => full.format(t) };
  }
  const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const dayOf = (t: number) => new Date(t).toDateString();
  const firsts = startsMs.filter((t, i) => i > 0 && dayOf(t) !== dayOf(startsMs[i - 1]));
  const every = Math.max(1, Math.ceil(firsts.length / 8));
  const ticks = firsts.filter((_, i) => i % every === 0);
  return { tick: (t) => date.format(t), full: (t) => full.format(t), ticks: ticks.length >= 2 ? ticks : undefined };
}

/** Axis tick text: 12px tertiary, the same on every chart. */
export const TICK = { fontSize: 12, fill: color.textTertiary };

export const PLOT_HEIGHT = 220;

/**
 * One stacked bar chart by model, with a legend that carries each model's
 * total over the period (the same figure as the table). The period's total is
 * the tile's, so the chart doesn't repeat it.
 */
const UsageChart = ({ title, sub, startsMs, barMs, series, format }: {
  title: string;
  /** "per hour, by model". */
  sub: string;
  startsMs: number[];
  barMs: number;
  series: StackSeries[];
  format: (v: number) => string;
}) => {
  const rows = startsMs.map((t, i) => ({ t, ...Object.fromEntries(series.map((s) => [s.key, s.data[i] ?? 0])) }));
  const time = timeAxis(startsMs, barMs);
  // No total in the header: the tile above shows it (one number in one place).
  return (
    <Section title={title}>
      <Typography sx={{ ...text.caption, marginTop: '-8px', marginBottom: '12px' }}>
        {sub}
      </Typography>
      {series.length === 0 ? (
        <Box sx={{ height: PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={text.secondary}>Nothing in this period.</Typography>
        </Box>
      ) : (
        <Box role="img" aria-label={`${title} ${sub}`} sx={{ width: '100%', height: PLOT_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={rows.length > 60 ? 0 : '12%'}>
              <CartesianGrid vertical={false} stroke={color.grid} />
              <XAxis dataKey="t" tickFormatter={time.tick} ticks={time.ticks} interval={time.ticks ? 0 : 'preserveEnd'} minTickGap={24} tick={TICK} tickLine={false} stroke={color.border} />
              <YAxis width={44} tickFormatter={compactWords} tick={TICK} tickLine={false} axisLine={false} />
              <Tooltip
                labelFormatter={(t: number) => time.full(t)}
                formatter={(v) => (typeof v === 'number' ? format(v) : '—')}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: color.border }}
              />
              {series.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId="usage" fill={s.color} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
      <Stack component="ul" direction="row" flexWrap="wrap" useFlexGap gap="8px 18px" sx={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
        {series.map((s) => (
          <Stack key={s.key} component="li" direction="row" alignItems="center" gap="6px" sx={{ fontSize: 13 }}>
            <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: s.color, flexShrink: 0 }} />
            <Box component="span" sx={{ color: 'text.secondary' }}>{s.label}</Box>
            <Box component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{format(s.total)}</Box>
          </Stack>
        ))}
      </Stack>
    </Section>
  );
};

export default UsageChart;
