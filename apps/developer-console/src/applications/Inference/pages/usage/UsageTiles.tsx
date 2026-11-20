import type { ReactNode } from 'react';
import { Box, Typography } from '@cluster-apps/ui';

import { changeText, countChangeText, fmtCount, gpuWords, type Tiles } from '~/inference/usageMath';
import { color, text } from '~/theme/tokens';

/**
 * The four tiles, each against the previous period: GPU units, requests,
 * refused (your limit / model full), and the model closest to its limit.
 */
const TONE = { neutral: color.textSecondary, bad: color.warning, good: color.success } as const;
const AT_LIMIT = color.warning;
const FULL = color.warningSoft;

function Tile({ label, value, sub, delta, deltaTone = 'neutral', foot }: {
  label: string;
  value: string;
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
        border: `1px solid ${color.border}`,
        borderRadius: '16px',
        backgroundColor: color.surface,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minHeight: 132,
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <Typography sx={text.secondary}>{label}</Typography>
      {/* The card-title size (Section's 18 bold): the shared scale's largest, no custom display font. */}
      <Typography sx={{ ...text.title, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
      <Typography sx={text.secondary}>{sub}</Typography>
      {delta && (
        <Typography sx={{ fontSize: 12, color: TONE[deltaTone], fontWeight: deltaTone === 'neutral' ? 400 : 600 }}>{delta}</Typography>
      )}
      <Box sx={{ marginTop: 'auto' }}>{foot}</Box>
    </Box>
  );
}

const UsageTiles = ({ tiles, prevLabel, scope = 'All models' }: { tiles: Tiles; prevLabel: string; /** "All models", "glm-5.3", "2 models". */ scope?: string }) => {
  const { gpu, requests, refused, closest } = tiles;
  const refusedChange = countChangeText(refused.total, refused.prevTotal, prevLabel);
  const share = (part: number) => `${refused.total ? (part / refused.total) * 100 : 0}%`;
  return (
    <Box
      component="section"
      aria-label="Totals"
      sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: '12px' }}
    >
      <Tile label="GPU units" value={gpuWords(gpu.total)} sub={scope} delta={changeText(gpu.change, prevLabel)} />
      <Tile label="Requests" value={fmtCount(requests.total)} sub={scope} delta={changeText(requests.change, prevLabel)} />
      <Tile
        label="Refused (429)"
        value={fmtCount(refused.total)}
        sub={`${fmtCount(refused.limit)} your limit · ${fmtCount(refused.full)} model full`}
        delta={refusedChange.text}
        deltaTone={refusedChange.tone}
        foot={
          refused.total > 0 ? (
            <Box aria-hidden sx={{ display: 'flex', height: 8, borderRadius: '4px', overflow: 'hidden', backgroundColor: color.grid }}>
              <Box sx={{ backgroundColor: AT_LIMIT, width: share(refused.limit) }} />
              <Box sx={{ backgroundColor: FULL, width: share(refused.full) }} />
            </Box>
          ) : undefined
        }
      />
      {closest ? (
        <Tile
          label="Closest to limit"
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
        <Tile label="Closest to limit" value="—" sub="Nothing in flight in this period" delta="" />
      )}
    </Box>
  );
};

export default UsageTiles;
