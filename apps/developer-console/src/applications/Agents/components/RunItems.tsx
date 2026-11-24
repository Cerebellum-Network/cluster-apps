import { ReactNode, useEffect, useRef } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@cluster-apps/ui';

import type { RunItem, ToolStatus } from '~/compute/runView';
import { color, mono, text } from '~/theme/tokens';
import { Markdown } from '../../Sandboxes/components/bits';
import { sbColor } from '../../Sandboxes/components/ui';

const TOOL_TONE: Record<ToolStatus, { fg: string; bg: string; label: string }> = {
  running: { fg: color.primaryDark, bg: color.primaryTint, label: 'running' },
  ok: { fg: color.success, bg: color.successTint, label: 'ok' },
  error: { fg: color.warning, bg: color.warningTint, label: 'error' },
  denied: { fg: sbColor.deniedText, bg: sbColor.deniedTint, label: 'denied' },
};

export const Label = ({ children }: { children: ReactNode }) => (
  <Typography sx={{ ...text.label, marginBottom: '6px' }}>{children}</Typography>
);

const ToolRow = ({ item }: { item: Extract<RunItem, { kind: 'tool' }> }) => {
  const tone = TOOL_TONE[item.status];
  const refused = item.status === 'denied';
  return (
    <Box
      sx={{
        border: `1px solid ${refused ? '#F3C2C2' : color.border}`,
        backgroundColor: refused ? sbColor.deniedTint : color.surface,
        borderRadius: '10px',
        padding: '9px 12px',
      }}
    >
      <Stack direction="row" alignItems="center" gap="8px" minWidth={0}>
        <Box
          component="span"
          sx={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: color.primaryDark, flexShrink: 0 }}
        >
          {item.tool}
        </Box>
        <Box
          component="span"
          sx={{
            fontFamily: mono,
            fontSize: 12.5,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={item.input}
        >
          {item.input}
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: 11.5,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '999px',
            color: tone.fg,
            backgroundColor: tone.bg,
            flexShrink: 0,
          }}
        >
          {item.status === 'running' ? (
            <CircularProgress size={9} thickness={7} sx={{ color: tone.fg, verticalAlign: '-1px' }} />
          ) : (
            tone.label
          )}
        </Box>
      </Stack>
      {item.output && item.status !== 'running' && (
        <Typography
          sx={{
            ...text.caption,
            marginTop: '5px',
            fontFamily: mono,
            whiteSpace: 'pre-wrap',
            color: refused ? sbColor.deniedText : color.textSecondary,
            maxHeight: 96,
            overflow: 'auto',
          }}
        >
          {item.output.length > 2000 ? `${item.output.slice(0, 2000)}…` : item.output}
        </Typography>
      )}
    </Box>
  );
};

/** What an agent did, row by row: its text, each tool call with its result or refusal, and log lines. */
export const RunItems = ({
  items,
  working,
  follow = true,
}: {
  items: RunItem[];
  working?: boolean;
  follow?: boolean;
}) => {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (follow && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [items.length, follow]);
  return (
    <Stack ref={scroller} spacing="8px" sx={{ maxHeight: 560, overflow: 'auto', paddingRight: '4px' }}>
      {items.map((it, i) =>
        it.kind === 'tool' ? (
          <ToolRow key={`${it.id}-${i}`} item={it} />
        ) : it.kind === 'text' ? (
          <Box key={i} sx={{ padding: '2px 2px' }}>
            <Markdown source={it.text} />
          </Box>
        ) : (
          <Typography
            key={i}
            sx={{
              fontFamily: mono,
              fontSize: 12,
              color: it.stream === 'stderr' ? color.warning : color.textTertiary,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {it.text}
          </Typography>
        ),
      )}
      {items.length === 0 && !working && <Typography sx={text.secondary}>Nothing recorded.</Typography>}
      {working && (
        <Stack direction="row" alignItems="center" gap="8px" sx={{ ...text.caption, padding: '4px 0' }}>
          <CircularProgress size={11} thickness={6} /> working
        </Stack>
      )}
    </Stack>
  );
};
