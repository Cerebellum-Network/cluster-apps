import { Fragment, useState, type ReactNode } from 'react';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Button, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Tooltip } from '@mui/material';
import { KeyboardArrowDown, KeyboardArrowRight, ReportProblemOutlined } from '@mui/icons-material';
import { color, mono, text } from '@cluster-apps/developer-console/src/theme/tokens';

import type { SourceError } from '~/api/types';
import { ApiError } from '~/api/client';

export { color, mono, text };

/** The developer console's card: white, 1px border, 16px radius. */
export function Section({
  title,
  actions,
  children,
  flush,
  subtitle,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  flush?: boolean;
}) {
  const hasHeader = !!title || !!actions;
  return (
    <Box
      sx={{
        backgroundColor: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {hasHeader && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
          sx={{ padding: '16px 22px 10px' }}
        >
          <Box minWidth={0}>
            {title && (
              <Typography component="h2" sx={{ ...text.title, fontSize: 16 }}>
                {title}
              </Typography>
            )}
            {subtitle && <Typography sx={{ ...text.caption, marginTop: '2px' }}>{subtitle}</Typography>}
          </Box>
          {actions && (
            <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
              {actions}
            </Stack>
          )}
        </Stack>
      )}
      <Box
        sx={{
          padding: flush ? 0 : '14px 22px 18px',
          paddingTop: hasHeader && !flush ? 0 : undefined,
          ...(flush && {
            '& .MuiTableCell-root:first-of-type:not([colspan])': { paddingLeft: '22px' },
            '& .MuiTableCell-root:last-of-type:not([colspan])': { paddingRight: '22px' },
          }),
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

const TONES = {
  neutral: { fg: color.textSecondary, bg: color.neutralFill },
  primary: { fg: color.primaryDark, bg: color.primaryTint },
  success: { fg: color.success, bg: color.successTint },
  warning: { fg: color.warning, bg: color.warningTint },
  danger: { fg: color.danger, bg: '#FBE9E7' },
} as const;

export type Tone = keyof typeof TONES;

export function Pill({ children, tone = 'neutral', title }: { children: ReactNode; tone?: Tone; title?: string }) {
  const pill = (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 8px',
        borderRadius: '999px',
        fontSize: '12px !important',
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color: TONES[tone].fg,
        backgroundColor: TONES[tone].bg,
      }}
    >
      {children}
    </Box>
  );
  return title ? <Tooltip title={title}>{pill}</Tooltip> : pill;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} minHeight={40} marginBottom={2}>
      <Box minWidth={0}>
        <Typography component="h1" sx={text.pageTitle}>
          {title}
        </Typography>
        {subtitle && <Typography sx={{ ...text.secondary, marginTop: '2px' }}>{subtitle}</Typography>}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1.5} alignItems="center" flexShrink={0}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

/** Where a number comes from, in one caption line. */
export function SourceLine({ children }: { children: ReactNode }) {
  return <Typography sx={{ ...text.caption, color: color.textTertiary, fontSize: 11.5 }}>{children}</Typography>;
}

/** A source that did not answer: shown instead of a number, never a zero. */
export function Missing({ error, compact }: { error: SourceError | ApiError | Error | string; compact?: boolean }) {
  let source = '';
  let detail = '';
  if (typeof error === 'string') detail = error;
  else if (error instanceof ApiError) {
    source = error.source?.source ?? '';
    detail = error.source?.detail ?? error.message;
  } else if (error instanceof Error) detail = error.message;
  else {
    source = error.source;
    detail = error.detail;
  }
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="flex-start"
      sx={{
        padding: compact ? '6px 10px' : '10px 12px',
        borderRadius: '10px',
        backgroundColor: color.warningTint,
        color: color.warning,
      }}
      role="status"
    >
      <ReportProblemOutlined sx={{ fontSize: 18, marginTop: '1px' }} />
      <Box minWidth={0}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: color.warning }}>
          Source missing{source ? `: ${source}` : ''}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: '#7A3A10', wordBreak: 'break-word' }}>{detail}</Typography>
      </Box>
    </Stack>
  );
}

/** One headline number with its label and source; or the missing source. */
export function Stat({
  label,
  value,
  sub,
  source,
  missing,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  source: string;
  missing?: SourceError | null;
  onClick?: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        backgroundColor: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: '16px',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: 0,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { borderColor: color.primary } : undefined,
      }}
    >
      <Typography sx={text.label}>{label}</Typography>
      {missing ? (
        <Missing error={missing} compact />
      ) : (
        <>
          <Typography
            sx={{
              fontSize: 26,
              lineHeight: '32px',
              fontWeight: 700,
              color: color.text,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </Typography>
          {sub && <Typography sx={{ ...text.secondary, fontSize: 12.5 }}>{sub}</Typography>}
        </>
      )}
      <SourceLine>{source}</SourceLine>
    </Box>
  );
}

export function Loading() {
  return (
    <Stack alignItems="center" padding={4}>
      <CircularProgress size={24} />
    </Stack>
  );
}

export function Mono({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <Box component="span" title={title} sx={{ fontFamily: mono, fontSize: 12.5 }}>
      {children}
    </Box>
  );
}

export interface Column<T> {
  label: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
  width?: number | string;
}

/**
 * A table whose rows open in place (the b2 pattern): a click shows `detail`
 * under the row, without leaving the page.
 */
export function RowsTable<T>({
  rows,
  columns,
  rowKey,
  detail,
  empty,
  groupHeader,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  detail?: (r: T) => ReactNode;
  empty?: ReactNode;
  /** Rows with a group header before them: return the header for the first row of a group. */
  groupHeader?: (r: T, i: number) => ReactNode | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const span = columns.length + (detail ? 1 : 0);
  return (
    <Table size="small" sx={{ '& td, & th': { fontSize: 13, paddingTop: '7px', paddingBottom: '7px' } }}>
      <TableHead>
        <TableRow sx={{ backgroundColor: color.inset }}>
          {detail && <TableCell width={28} />}
          {columns.map((c, i) => (
            <TableCell key={i} align={c.align} width={c.width}>
              {c.label}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={span} sx={{ color: color.textSecondary, padding: '18px 22px' }}>
              {empty ?? 'Nothing to show.'}
            </TableCell>
          </TableRow>
        )}
        {rows.map((r, i) => {
          const k = rowKey(r);
          const isOpen = open === k;
          const header = groupHeader?.(r, i);
          return (
            <Fragment key={k}>
              {header && (
                <TableRow>
                  <TableCell
                    colSpan={span}
                    sx={{ backgroundColor: '#FBFBFC', fontWeight: 600, fontSize: '12.5px !important' }}
                  >
                    {header}
                  </TableCell>
                </TableRow>
              )}
              <TableRow
                hover={!!detail}
                onClick={detail ? () => setOpen(isOpen ? null : k) : undefined}
                sx={{ cursor: detail ? 'pointer' : 'default', '& > td': isOpen ? { borderBottom: 'none' } : undefined }}
              >
                {detail && (
                  <TableCell sx={{ paddingRight: 0 }}>
                    {isOpen ? (
                      <KeyboardArrowDown sx={{ fontSize: 18 }} />
                    ) : (
                      <KeyboardArrowRight sx={{ fontSize: 18, color: color.textTertiary }} />
                    )}
                  </TableCell>
                )}
                {columns.map((c, ci) => (
                  <TableCell key={ci} align={c.align} sx={{ verticalAlign: 'top' }}>
                    {c.render(r)}
                  </TableCell>
                ))}
              </TableRow>
              {detail && isOpen && (
                <TableRow>
                  <TableCell colSpan={span} sx={{ backgroundColor: color.inset, padding: '12px 22px 16px 50px' }}>
                    {detail(r)}
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** A "Load more" button for cursor pages. */
export function LoadMore({
  cursor,
  onMore,
  loading,
}: {
  cursor: string | null | undefined;
  onMore: () => void;
  loading?: boolean;
}) {
  if (!cursor) return null;
  return (
    <Stack alignItems="center" padding={1.5}>
      <Button size="small" variant="outlined" onClick={onMore} disabled={loading}>
        Load more
      </Button>
    </Stack>
  );
}

/** Small key-value rows for an opened row. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 2, rowGap: '4px', fontSize: 13 }}>
      {items.map(([k, v]) => (
        <Fragment key={k}>
          <Typography sx={{ ...text.caption, lineHeight: '20px' }}>{k}</Typography>
          <Box sx={{ fontSize: 13, lineHeight: '20px', minWidth: 0, wordBreak: 'break-word' }}>{v}</Box>
        </Fragment>
      ))}
    </Box>
  );
}

export function Chip({ children, tone }: { children: ReactNode; tone?: 'warn' | 'bad' }) {
  const bg = tone === 'bad' ? '#FBE9E7' : tone === 'warn' ? color.warningTint : color.neutralFill;
  const fg = tone === 'bad' ? color.danger : tone === 'warn' ? color.warning : color.text;
  return (
    <Box
      component="span"
      sx={{
        height: 26,
        padding: '0 10px',
        borderRadius: '13px',
        backgroundColor: bg,
        color: fg,
        fontSize: 12.5,
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {children}
    </Box>
  );
}
