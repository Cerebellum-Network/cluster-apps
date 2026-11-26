import { Fragment, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import {
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import {
  Close,
  InfoOutlined,
  KeyboardArrowDown,
  KeyboardArrowRight,
  Refresh,
  ReportProblemOutlined,
} from '@mui/icons-material';
import { color, mono, text } from '@cluster-apps/developer-console/src/theme/tokens';

import type { SourceError } from '~/api/types';
import { ApiError } from '~/api/client';
import { time } from '~/format';

export { color, mono, text };

/** Hairline between the parts of one panel. */
export const hairline = `1px solid ${color.border}`;

/** The developer console's card: white, 1px border, 16px radius. A card holds a chart or a table. */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  flush,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  /** No inner padding: a table runs edge to edge. */
  flush?: boolean;
}) {
  const hasHeader = !!title || !!actions;
  return (
    <Box
      component="section"
      sx={{ backgroundColor: color.surface, border: hairline, borderRadius: '16px', overflow: 'hidden', minWidth: 0 }}
    >
      {hasHeader && (
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          gap={2}
          sx={{ padding: '18px 22px 0' }}
        >
          <Box minWidth={0}>
            {title && (
              <Typography component="h2" sx={{ fontSize: 16, lineHeight: '22px', fontWeight: 700, color: color.text }}>
                {title}
              </Typography>
            )}
            {subtitle && <Typography sx={{ ...text.secondary, marginTop: '2px' }}>{subtitle}</Typography>}
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
          padding: flush ? 0 : '16px 22px 20px',
          marginTop: hasHeader && flush ? '14px' : 0,
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

/** A status: a dot and its words, never colour alone. */
export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" component="span" sx={{ whiteSpace: 'nowrap' }}>
      <Box
        component="span"
        aria-hidden
        sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: TONES[tone].fg, flexShrink: 0 }}
      />
      <Box component="span" sx={{ fontSize: 13, color: color.text }}>
        {children}
      </Box>
    </Stack>
  );
}

/** The page's title, one line on what it answers, and when it was read. */
export function PageHeader({
  title,
  subtitle,
  actions,
  updatedAt,
  onRefresh,
  refreshing,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  updatedAt?: Date | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <Stack
      direction="row"
      alignItems="flex-end"
      justifyContent="space-between"
      gap={2}
      flexWrap="wrap"
      marginBottom={2.5}
    >
      <Box minWidth={0}>
        <Typography component="h1" sx={text.pageTitle}>
          {title}
        </Typography>
        {subtitle && <Typography sx={{ ...text.secondary, marginTop: '4px', maxWidth: 760 }}>{subtitle}</Typography>}
      </Box>
      <Stack direction="row" spacing={1.5} alignItems="center" flexShrink={0}>
        {actions}
        {onRefresh && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            {updatedAt && (
              <Typography sx={{ ...text.caption, color: color.textTertiary }}>
                Updated {updatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </Typography>
            )}
            <Tooltip title="Read again">
              <span>
                <IconButton size="small" onClick={onRefresh} disabled={refreshing} aria-label="Read again">
                  <Refresh sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}

/** A failed read as a source error. */
export function asSourceError(e: SourceError | ApiError | Error | string): SourceError {
  if (typeof e === 'string') return { source: '', detail: e };
  if (e instanceof ApiError) return e.source ?? { source: 'console backend', detail: e.message };
  if (e instanceof Error) return { source: 'console backend', detail: e.message };
  return e;
}

/** Plain name of a source string such as `resource-manager GET /api/v1/nodes`. */
function sourceName(s: string): string {
  const head = s.split(' GET ')[0].split(' DdcClusters')[0];
  const names: Record<string, string> = {
    'resource-manager': 'the resource manager',
    'egress-proxy': 'the egress proxy',
    blockchain: 'the blockchain',
    'console backend': 'the console backend',
  };
  if (head.startsWith('DAC')) return 'DAC';
  return names[head] ?? head;
}

/**
 * A source the console reads that did not answer: a warning, with the reason
 * behind the icon. Never replaced by a zero.
 */
export function CouldNotRead({
  error,
  what,
}: {
  error: SourceError | ApiError | Error | string;
  /** What it was for, e.g. "usage". */
  what?: string;
}) {
  const e = asSourceError(error);
  const from = e.source ? sourceName(e.source) : '';
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="flex-start"
      role="status"
      sx={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: color.warningTint }}
    >
      <ReportProblemOutlined sx={{ fontSize: 18, marginTop: '1px', color: color.warning }} />
      <Box minWidth={0}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: color.warning }}>
          Couldn’t read {what ?? 'this'}
          {from ? ` from ${from}` : ''}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: '#7A3A10', wordBreak: 'break-word' }}>{e.detail}</Typography>
      </Box>
    </Stack>
  );
}

/**
 * Something the console has no source for yet: one quiet line, with why
 * behind the icon. Not a warning: nothing failed.
 */
export function NotYet({ children, why }: { children: ReactNode; why?: ReactNode }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ color: color.textSecondary }}>
      <Typography component="div" sx={{ ...text.secondary, color: color.textSecondary }}>
        <Box component="span" sx={{ fontWeight: 600 }}>
          Not available yet:
        </Box>{' '}
        {children}
      </Typography>
      {why && (
        <Tooltip title={why}>
          <InfoOutlined sx={{ fontSize: 16, marginTop: '1px', color: color.textTertiary, cursor: 'help' }} />
        </Tooltip>
      )}
    </Stack>
  );
}

/** A ratio against a limit. The fill carries severity; the track is a lighter step of the same hue. */
export function Meter({
  value,
  max,
  label,
  plain,
}: {
  value: number;
  max: number;
  label: string;
  /** No severity: a high share is expected (e.g. GPU memory holding loaded models). */
  plain?: boolean;
}) {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const level = plain ? 0 : share >= 0.9 ? 2 : share >= 0.8 ? 1 : 0;
  const tone = [color.primary, color.warning, color.danger][level];
  const track = [color.primaryTint, color.warningTint, '#FBE9E7'][level];
  return (
    <Box
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      sx={{ height: 8, borderRadius: '4px', backgroundColor: track, overflow: 'hidden' }}
    >
      <Box
        sx={{
          height: '100%',
          width: `${share * 100}%`,
          minWidth: value > 0 ? 3 : 0,
          backgroundColor: tone,
          borderRadius: '4px',
        }}
      />
    </Box>
  );
}

/** A strip of figures in one panel, divided by hairlines (not one card each). */
export function Figures({ children, columns }: { children: ReactNode; columns: number }) {
  return (
    <Box
      sx={{
        backgroundColor: color.surface,
        border: hairline,
        borderRadius: '16px',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: `repeat(${columns}, minmax(0, 1fr))` },
        overflow: 'hidden',
        '& > *': { borderTop: hairline, borderLeft: hairline, marginTop: '-1px', marginLeft: '-1px' },
      }}
    >
      {children}
    </Box>
  );
}

/** One figure: a label, a value, a line under it and room for a meter or strip. Opens its page when `to` is set. */
export function Figure({
  label,
  value,
  unit,
  sub,
  children,
  to,
}: {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  to?: string;
}) {
  const nav = useNavigate();
  return (
    <Box
      onClick={to ? () => nav(to) : undefined}
      onKeyDown={to ? (e) => e.key === 'Enter' && nav(to) : undefined}
      tabIndex={to ? 0 : undefined}
      role={to ? 'link' : undefined}
      sx={{
        padding: '18px 22px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: 0,
        cursor: to ? 'pointer' : 'default',
        '&:hover': to ? { backgroundColor: color.inset } : undefined,
        '&:focus-visible': { outline: `2px solid ${color.primary}`, outlineOffset: '-2px' },
      }}
    >
      <Typography sx={{ fontSize: 13, lineHeight: '18px', fontWeight: 600, color: color.textSecondary }}>
        {label}
      </Typography>
      <Typography component="div" sx={{ fontSize: 28, lineHeight: '34px', fontWeight: 700, color: color.text }}>
        {value}
        {unit && (
          <Box component="span" sx={{ fontSize: 15, fontWeight: 600, color: color.textSecondary, marginLeft: '6px' }}>
            {unit}
          </Box>
        )}
      </Typography>
      {sub && (
        <Typography component="div" sx={{ ...text.secondary }}>
          {sub}
        </Typography>
      )}
      {children && <Box sx={{ marginTop: '6px' }}>{children}</Box>}
    </Box>
  );
}

export function Loading({ label = 'Reading…' }: { label?: string }) {
  return (
    <Stack alignItems="center" justifyContent="center" padding={4} spacing={1}>
      <CircularProgress size={22} />
      <Typography sx={{ ...text.caption, color: color.textTertiary }}>{label}</Typography>
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

/** A section heading inside a page: sentence case, no eyebrow. */
export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <Box sx={{ margin: '28px 0 12px' }}>
      <Typography component="h2" sx={{ fontSize: 16, lineHeight: '22px', fontWeight: 700 }}>
        {children}
      </Typography>
      {sub && <Typography sx={{ ...text.secondary, marginTop: '2px' }}>{sub}</Typography>}
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
 * A table. A row opens in place (`detail`), or calls `onOpen` (a drawer).
 * Numbers in columns use tabular figures.
 */
export function RowsTable<T>({
  rows,
  columns,
  rowKey,
  detail,
  onOpen,
  empty,
  groupHeader,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  detail?: (r: T) => ReactNode;
  onOpen?: (r: T) => void;
  empty?: ReactNode;
  groupHeader?: (r: T, i: number) => ReactNode | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const expands = !!detail;
  const clickable = expands || !!onOpen;
  const span = columns.length + (expands ? 1 : 0);
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table
        size="small"
        sx={{
          '& td, & th': { fontSize: 13, paddingTop: '9px', paddingBottom: '9px', borderColor: color.grid },
          '& td': { fontVariantNumeric: 'tabular-nums' },
          '& th': { ...text.label, whiteSpace: 'nowrap' },
        }}
      >
        <TableHead>
          <TableRow sx={{ backgroundColor: color.inset }}>
            {expands && <TableCell width={28} />}
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
              <TableCell colSpan={span} sx={{ color: color.textSecondary, padding: '22px !important' }}>
                {empty ?? 'Nothing to show.'}
              </TableCell>
            </TableRow>
          )}
          {rows.map((r, i) => {
            const k = rowKey(r);
            const isOpen = open === k;
            const header = groupHeader?.(r, i);
            const activate = () => (onOpen ? onOpen(r) : setOpen(isOpen ? null : k));
            return (
              <Fragment key={k}>
                {header && (
                  <TableRow>
                    <TableCell colSpan={span} sx={{ backgroundColor: color.inset, fontWeight: 600 }}>
                      {header}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow
                  hover={clickable}
                  onClick={clickable ? activate : undefined}
                  onKeyDown={clickable ? (e) => e.key === 'Enter' && activate() : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  sx={{
                    cursor: clickable ? 'pointer' : 'default',
                    '& > td': isOpen ? { borderBottom: 'none' } : undefined,
                    '&:focus-visible': { outline: `2px solid ${color.primary}`, outlineOffset: '-2px' },
                  }}
                >
                  {expands && (
                    <TableCell sx={{ paddingRight: 0 }}>
                      {isOpen ? (
                        <KeyboardArrowDown sx={{ fontSize: 18 }} />
                      ) : (
                        <KeyboardArrowRight sx={{ fontSize: 18, color: color.textTertiary }} />
                      )}
                    </TableCell>
                  )}
                  {columns.map((c, ci) => (
                    <TableCell key={ci} align={c.align} sx={{ verticalAlign: 'middle' }}>
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
    </Box>
  );
}

/** A "Show more" button for cursor pages. */
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
        Show more
      </Button>
    </Stack>
  );
}

/** Small key–value rows. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 2, rowGap: '6px', fontSize: 13 }}>
      {items.map(([k, v]) => (
        <Fragment key={k}>
          <Typography sx={{ ...text.caption, lineHeight: '20px' }}>{k}</Typography>
          <Box sx={{ fontSize: 13, lineHeight: '20px', minWidth: 0, wordBreak: 'break-word' }}>{v}</Box>
        </Fragment>
      ))}
    </Box>
  );
}

/** A panel that slides in from the right, for one item's detail. */
export function SideDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 520 } } }}>
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        sx={{ padding: '20px 24px 12px', borderBottom: hairline }}
      >
        <Box minWidth={0}>
          <Typography component="h2" sx={{ ...text.title, wordBreak: 'break-all' }}>
            {title}
          </Typography>
          {subtitle && <Typography sx={{ ...text.secondary, marginTop: '4px' }}>{subtitle}</Typography>}
        </Box>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <Close sx={{ fontSize: 20 }} />
        </IconButton>
      </Stack>
      <Box sx={{ padding: '18px 24px 28px', overflowY: 'auto' }}>{children}</Box>
    </Drawer>
  );
}

/** A block inside a drawer: a heading and its content. */
export function DrawerBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ '& + &': { marginTop: 3 } }}>
      <Typography sx={{ ...text.label, marginBottom: 1 }}>{title}</Typography>
      {children}
    </Box>
  );
}

/** "Show details" that opens raw records in place. */
export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <Button
        size="small"
        variant="text"
        color="secondary"
        onClick={() => setOpen((o) => !o)}
        startIcon={open ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
        sx={{ paddingLeft: 0, textTransform: 'none' }}
        aria-expanded={open}
      >
        {label}
      </Button>
      {open && <Box sx={{ marginTop: 1 }}>{children}</Box>}
    </Box>
  );
}

/** When a figure was read, for a tooltip. */
export const readAt = (iso: string | null | undefined) => (iso ? `Read ${time(iso)}` : '');
