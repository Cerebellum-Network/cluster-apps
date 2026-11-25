import { ReactNode } from 'react';
import { Box, Typography } from '@cluster-apps/ui';

import type { Sandbox } from '~/compute/types';
import { isLive } from '~/compute/types';
import { fmtBytes, fmtDuration, fmtMib, fmtQty } from '~/compute/format';
import { color, text } from '~/theme/tokens';
import { Meter, sbColor } from '../ui';

/** A tiny line of recent values, newest on the right. */
export const Spark = ({ values, max, tone = color.primary }: { values: number[]; max: number; tone?: string }) => {
  const w = 120;
  const h = 28;
  if (values.length < 2) return <Box sx={{ height: h }} />;
  const pts = values.map(
    (v, i) => `${(i / (values.length - 1)) * w},${h - (Math.min(v, max) / (max || 1)) * (h - 2) - 1}`,
  );
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={`${tone}1A`} stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke={tone} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const Cell = ({
  label,
  value,
  sub,
  children,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
}) => (
  <Box
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
    {sub && <Typography sx={{ ...text.caption, marginTop: '1px' }}>{sub}</Typography>}
    {children && <Box sx={{ marginTop: '8px' }}>{children}</Box>}
  </Box>
);

/**
 * What the node measures for this sandbox (`usage` on `GET /v1/sandboxes/{id}`,
 * live while it runs, final after): the quantities its usage records bill,
 * CPU-seconds and GiB-seconds, and the rest it measures. `cpuHistory` is CPU
 * utilisation (0..1) between successive readings.
 */
const UsageMeter = ({ sandbox, cpuHistory }: { sandbox: Sandbox; cpuHistory: number[] }) => {
  const u = sandbox.usage;
  const util = u.wall_s > 0 && sandbox.resources.cpu > 0 ? u.cpu_s / (u.wall_s * sandbox.resources.cpu) : 0;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' },
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
        label="CPU"
        value={`${fmtQty(u.cpu_s)} CPU-s`}
        sub={`${Math.round(util * 100)}% of ${sandbox.resources.cpu} vCPU on average`}
      >
        <Spark values={cpuHistory} max={1} />
      </Cell>
      <Cell
        label="Memory"
        value={`${fmtQty(u.ram_gib_s)} GiB-s`}
        sub={`peak ${fmtMib(u.memory_peak_mib)} of ${fmtMib(sandbox.resources.memory_mib)}`}
      >
        <Meter value={u.memory_peak_mib} max={sandbox.resources.memory_mib} tone={sbColor.running} />
      </Cell>
      <Cell
        label="Network"
        value={fmtBytes(u.net_egress_bytes + u.net_ingress_bytes)}
        sub={`out ${fmtBytes(u.net_egress_bytes)} · in ${fmtBytes(u.net_ingress_bytes)}`}
      />
      <Cell label="Disk peak" value={fmtMib(u.disk_peak_mib)} sub="largest size of its files, measured (not billed)" />
    </Box>
  );
};

export default UsageMeter;
