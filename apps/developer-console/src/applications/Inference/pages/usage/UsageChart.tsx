import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Section } from '~/components';
import { compactWords, type StackSeries } from '~/inference/usageMath';

/** Bar labels in local time: hours within a day or so, dates beyond. */
export function timeFormat(barMs: number): { tick: (t: number) => string; full: (t: number) => string } {
  const daily = barMs >= 6 * 3_600_000;
  const tick = new Intl.DateTimeFormat('en-US', daily ? { month: 'short', day: 'numeric' } : { hour: '2-digit', minute: '2-digit', hour12: false });
  const full = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  return { tick: (t) => tick.format(t), full: (t) => full.format(t) };
}

export const PLOT_HEIGHT = 220;

/**
 * One stacked bar chart by model, with a legend that carries each model's
 * total over the period (the same figure as the tiles and the table).
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
  const time = timeFormat(barMs);
  const total = series.reduce((n, s) => n + s.total, 0);
  return (
    <Section
      title={title}
      actions={
        <Typography variant="body2" color="text.secondary">
          {format(total)} total
        </Typography>
      }
    >
      <Typography variant="body2" color="text.secondary" sx={{ marginTop: '-8px', marginBottom: '12px' }}>
        {sub}
      </Typography>
      {series.length === 0 ? (
        <Box sx={{ height: PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">Nothing in this period.</Typography>
        </Box>
      ) : (
        <Box role="img" aria-label={`${title} ${sub}`} sx={{ width: '100%', height: PLOT_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={rows.length > 60 ? 0 : '12%'}>
              <CartesianGrid vertical={false} stroke="#EEEFF5" />
              <XAxis dataKey="t" tickFormatter={time.tick} minTickGap={24} tick={{ fontSize: 11, fill: '#6B6A7B' }} tickLine={false} />
              <YAxis width={44} tickFormatter={compactWords} tick={{ fontSize: 11, fill: '#6B6A7B' }} tickLine={false} axisLine={false} />
              <Tooltip
                labelFormatter={(t: number) => time.full(t)}
                formatter={(v) => (typeof v === 'number' ? format(v) : '—')}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
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
