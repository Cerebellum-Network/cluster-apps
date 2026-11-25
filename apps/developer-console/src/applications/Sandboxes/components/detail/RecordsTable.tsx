import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@cluster-apps/ui';

import { recordBilling } from '~/compute/billing';
import type { DacStatus, UsageRecord } from '~/compute/types';
import { fmtClock, fmtQty, fmtUtc, localZone } from '~/compute/format';
import { color, text } from '~/theme/tokens';

/**
 * Whether a minute of usage has been counted for billing, in words: the node
 * signs each record and hands it to the network's accounting (its DAC agent);
 * a developer needs to know only whether that happened.
 */
export const COUNTED: Record<DacStatus, { label: string; fg: string; title: string }> = {
  pushed: { label: 'Counted', fg: color.success, title: 'Counted for billing.' },
  pending: { label: 'Waiting', fg: color.textSecondary, title: 'Not counted yet; the node sends it again shortly.' },
  failed: { label: 'Not counted', fg: color.danger, title: 'Refused for billing.' },
};

export const CountedLabel = ({ status, error }: { status: DacStatus; error?: string | null }) => {
  const c = COUNTED[status] ?? COUNTED.pending;
  return (
    <Box
      component="span"
      title={error ? `${c.title} ${error}` : c.title}
      sx={{ fontSize: 13, fontWeight: 600, color: c.fg, whiteSpace: 'nowrap' }}
    >
      {c.label}
    </Box>
  );
};

/**
 * A sandbox's usage minute by minute (one record per wall-clock minute plus
 * the last one when it ended): what was billed, what was measured, and whether
 * it has been counted. The record's own fields (id, node, units) are in the
 * row's tooltip, not on the page.
 */
const RecordsTable = ({ records, empty }: { records: UsageRecord[]; empty?: string }) => {
  const head = { backgroundColor: color.inset };
  return (
    <Box sx={{ border: `1px solid ${color.border}`, borderRadius: '12px', overflow: 'auto', maxHeight: 560 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={head}>Minute ({localZone()})</TableCell>
            <TableCell sx={head} align="right">
              Billed CPU-s
            </TableCell>
            <TableCell sx={head} align="right">
              Measured CPU-s
            </TableCell>
            <TableCell sx={head} align="right">
              Billed GiB-s
            </TableCell>
            <TableCell sx={head} align="right">
              Measured GiB-s
            </TableCell>
            <TableCell sx={head}>Billing</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {records.map((r) => {
            const billed = recordBilling(r);
            return (
              <TableRow
                key={r.record_id}
                title={`Record ${r.record_id}, ${fmtUtc(r.period_start)} – ${fmtUtc(r.period_end)} UTC, ${billed.basis} basis, reserved ${billed.reserved}`}
              >
                <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                  {fmtClock(r.period_start)}–{fmtClock(r.period_end)}
                  {r.final && (
                    <Typography sx={{ ...text.caption, color: color.text }}>
                      ended{r.exit_reason ? `: ${r.exit_reason}` : ''}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {fmtQty(billed.cpu)}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: color.textSecondary }}>
                  {fmtQty(r.cpu_s)}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {fmtQty(billed.ram)}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: color.textSecondary }}>
                  {fmtQty(r.ram_gib_s)}
                </TableCell>
                <TableCell>
                  <CountedLabel status={r.dac_status} error={r.dac_error} />
                </TableCell>
              </TableRow>
            );
          })}
          {records.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} sx={{ textAlign: 'center', padding: '28px' }}>
                <Typography sx={text.secondary}>{empty ?? 'No usage yet. It appears minute by minute.'}</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
};

export default RecordsTable;
