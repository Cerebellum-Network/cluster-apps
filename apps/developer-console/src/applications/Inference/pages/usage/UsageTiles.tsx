import type { ReactNode } from 'react';
import { Box, Typography } from '@cluster-apps/ui';

import { changeText, countChangeText, fmtCount, gpuWords, type Tiles } from '~/inference/usageMath';

/**
 * The four tiles, each against the previous period: GPU units, requests,
 * refused (your limit / model full), and the model closest to its limit.
 */
const TONE = { neutral: 'text.secondary', bad: '#b4410c', good: '#1c6b38' } as const;
const AT_LIMIT = '#b4410c';
const FULL = '#f0b98f';

function Tile({ label, value, small, sub, delta, deltaTone = 'neutral', foot }: {
  label: string;
  value: string;
  small?: boolean;
  sub: string;
  delta: string;
  deltaTone?: keyof typeof TONE;
  foot?: ReactNode;
}) {
  return (
    <Box
      role="group"
      aria-label={label}
      sx={{
        border: '1px solid #E3E4EE',
        borderRadius: '16px',
        backgroundColor: '#fff',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minHeight: 150,
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <Typography sx={{ color: 'text.secondary', fontWeight: 500, fontSize: 14 }}>{label}</Typography>
      <Typography
        sx={small
          ? { fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere', minHeight: 34, lineHeight: 1.3 }
          : { fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.2, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{sub}</Typography>
      {delta && (
        <Typography sx={{ fontSize: 13, color: TONE[deltaTone], fontWeight: deltaTone === 'neutral' ? 400 : 500 }}>{delta}</Typography>
      )}
      <Box sx={{ marginTop: 'auto' }}>{foot}</Box>
    </Box>
  );
}

const UsageTiles = ({ tiles, prevLabel }: { tiles: Tiles; prevLabel: string }) => {
  const { gpu, requests, refused, closest } = tiles;
  const refusedChange = countChangeText(refused.total, refused.prevTotal, prevLabel);
  const share = (part: number) => `${refused.total ? (part / refused.total) * 100 : 0}%`;
  return (
    <Box
      component="section"
      aria-label="Totals"
      sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: '12px' }}
    >
      <Tile label="GPU units" value={gpuWords(gpu.total)} sub="All models" delta={changeText(gpu.change, prevLabel)} />
      <Tile label="Requests" value={fmtCount(requests.total)} sub="All models" delta={changeText(requests.change, prevLabel)} />
      <Tile
        label="Refused (429)"
        value={fmtCount(refused.total)}
        sub={`${fmtCount(refused.limit)} your limit · ${fmtCount(refused.full)} model full`}
        delta={refusedChange.text}
        deltaTone={refusedChange.tone}
        foot={
          refused.total > 0 ? (
            <Box aria-hidden sx={{ display: 'flex', height: 8, borderRadius: '4px', overflow: 'hidden', backgroundColor: '#f1eef8' }}>
              <Box sx={{ backgroundColor: AT_LIMIT, width: share(refused.limit) }} />
              <Box sx={{ backgroundColor: FULL, width: share(refused.full) }} />
            </Box>
          ) : undefined
        }
      />
      {closest ? (
        <Tile
          label="Closest to limit"
          small
          value={closest.model}
          sub={
            closest.limit
              ? `${fmtCount(closest.peak)} / ${fmtCount(closest.limit)} in flight${closest.othersAtLimit ? ` · ${closest.othersAtLimit} more at their limit` : ''}`
              : `${fmtCount(closest.peak)} in flight · no limit set`
          }
          delta={
            closest.limit
              ? `Was ${fmtCount(closest.prevPeak)} / ${fmtCount(closest.limit)} in the ${prevLabel}`
              : `Was ${fmtCount(closest.prevPeak)} in the ${prevLabel}`
          }
        />
      ) : (
        <Tile label="Closest to limit" small value="—" sub="Nothing in flight in this period" delta="" />
      )}
    </Box>
  );
};

export default UsageTiles;
