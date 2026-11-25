import { ReactNode } from 'react';
import { Box, Typography } from '@cluster-apps/ui';

import type { Sandbox } from '~/compute/types';
import { isLive } from '~/compute/types';
import { billedCPU, billedMemory, CACHE_NOTE, measuredIncludesCache, partsLine, usageParts } from '~/compute/billing';
import { fmtBytes, fmtDuration, fmtMib, fmtQty } from '~/compute/format';
import { cpuCeiling, cpuLine, memoryCeiling, memoryLine } from '~/compute/resources';
import { color, text } from '~/theme/tokens';
import { RangeMeter, sbColor } from '../ui';

/** Cores with two decimals, and "< 0.01" for a sandbox that barely used any. */
export const fmtCores = (v: number): string => (v > 0 && v < 0.01 ? '< 0.01' : `${+v.toFixed(2)}`);

/**
 * A tiny line of recent values, newest on the right, from 0 to `max`. `guide`
 * draws a dashed line at that value (the request: above it is burst).
 */
export const Spark = ({
  values,
  max,
  guide,
  tone = color.primary,
}: {
  values: number[];
  max: number;
  guide?: number;
  tone?: string;
}) => {
  const w = 120;
  const h = 28;
  if (values.length < 2) return null;
  const y = (v: number) => h - (Math.min(v, max) / (max || 1)) * (h - 2) - 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${y(v)}`);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={`${tone}1A`} stroke="none" />
      {guide !== undefined && guide < max && (
        <line
          x1={0}
          x2={w}
          y1={y(guide)}
          y2={y(guide)}
          stroke={color.textTertiary}
          strokeWidth={1}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline points={pts.join(' ')} fill="none" stroke={tone} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const Cell = ({
  label,
  value,
  sub,
  note,
  title,
  children,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** A caption under the chart (or under `sub`). */
  note?: ReactNode;
  /** The whole billing line, for the tooltip. */
  title?: string;
  children?: ReactNode;
}) => (
  <Box
    title={title || undefined}
    sx={{
      padding: '14px 18px',
      minWidth: 0,
      borderRight: `1px solid ${color.grid}`,
      '&:last-of-type': { borderRight: 'none' },
    }}
  >
    <Typography sx={text.secondary}>{label}</Typography>
    <Typography sx={{ ...text.value, fontSize: 18, fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
      {value}
    </Typography>
    {sub && <Typography sx={{ ...text.caption, marginTop: '1px', color: color.text }}>{sub}</Typography>}
    {children && <Box sx={{ marginTop: '8px' }}>{children}</Box>}
    {note && <Typography sx={{ ...text.caption, marginTop: '6px' }}>{note}</Typography>}
  </Box>
);

/**
 * This sandbox's usage (`usage` on `GET /v1/sandboxes/{id}`, live while it
 * runs, final after). CPU and memory: what is billed, split into the
 * guaranteed floor (the request for as long as it runs) and the burst above
 * it, with the CLI's whole line in the tooltip; under it, the use against the
 * request and the limit (CPU over time with the request as a dashed line, the
 * memory peak on a bar that runs to the limit with the request marked). A
 * gateway without the billing fields shows the measured amounts alone, and
 * one without limits the request alone. `cpuHistory` is cores used between
 * successive readings.
 */
const UsageMeter = ({ sandbox, cpuHistory }: { sandbox: Sandbox; cpuHistory: number[] }) => {
  const u = sandbox.usage;
  const r = sandbox.resources;
  const parts = usageParts(u);
  const avg = u.wall_s > 0 ? u.cpu_s / u.wall_s : 0;
  const peak = u.cpu_peak ?? 0;
  // Room above the request for a burst to show, up to the limit; no room when the request is the limit.
  const sparkMax = Math.min(cpuCeiling(r), Math.max(r.cpu * 1.25, peak, ...cpuHistory, 0.01));
  // Against the request and limit; a gateway before limits reports the request alone ("of 1 vCPU").
  const cpuUse =
    `uses ${fmtCores(avg)} vCPU on average${peak > 0 ? `, peak ${fmtCores(peak)}` : ''}` +
    (r.cpu_limit ? `; ${cpuLine(r)}` : ` of ${cpuLine(r)}`);
  const memoryUse =
    `peak ${fmtMib(u.memory_peak_mib)}${r.memory_limit_mib ? '; ' : ' of '}${memoryLine(r)}` +
    (parts && measuredIncludesCache(u.ram_gib_s, parts.ram.billed)
      ? `. Measured ${fmtQty(u.ram_gib_s)} GiB-s, ${CACHE_NOTE}.`
      : '');
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: '0.8fr 1.3fr 1.3fr 1fr 1fr' },
        backgroundColor: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <Cell
        label="Running for"
        value={fmtDuration(u.wall_s)}
        sub={isLive(sandbox.status) ? 'live from the node' : 'final'}
      />
      <Cell
        label={parts ? 'CPU billed' : 'CPU'}
        value={`${fmtQty(parts ? parts.cpu.billed : u.cpu_s)} CPU-s`}
        sub={parts ? partsLine(parts.cpu, fmtQty) : 'measured'}
        title={billedCPU(u, r.cpu) ? `billed ${billedCPU(u, r.cpu)}` : undefined}
        note={cpuUse}
      >
        {cpuHistory.length > 1 && <Spark values={cpuHistory} max={sparkMax} guide={r.cpu} />}
      </Cell>
      <Cell
        label={parts ? 'Memory billed' : 'Memory'}
        value={`${fmtQty(parts ? parts.ram.billed : u.ram_gib_s)} GiB-s`}
        sub={parts ? partsLine(parts.ram, fmtQty) : 'measured'}
        title={billedMemory(u, r.memory_mib) ? `billed ${billedMemory(u, r.memory_mib)}` : undefined}
        note={memoryUse}
      >
        <RangeMeter
          value={u.memory_peak_mib}
          request={r.memory_mib}
          limit={memoryCeiling(r)}
          tone={sbColor.running}
          label="Memory peak"
        />
      </Cell>
      <Cell
        label="Network"
        value={fmtBytes(u.net_egress_bytes + u.net_ingress_bytes)}
        sub={`out ${fmtBytes(u.net_egress_bytes)}, in ${fmtBytes(u.net_ingress_bytes)}`}
      />
      <Cell label="Disk peak" value={fmtMib(u.disk_peak_mib)} sub="largest size of its files, measured (not billed)" />
    </Box>
  );
};

export default UsageMeter;
