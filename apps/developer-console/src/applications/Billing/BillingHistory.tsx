import { Box, Typography, Stack, Button, Table, TableHead, TableBody, TableRow, TableCell } from '@cluster-apps/ui';
import { useState } from 'react';

import type { LedgerEntry } from '~/billing/api';
import { num, shortDate, signedMoney, money } from '~/billing/format';

/**
 * All transactions — the full ledger, paged. The per-month view lives in each
 * bill's balance box now, so this has no type-filter chips (#190 review); the
 * "Download CSV" action sits in the section header. The on-chain status column
 * from the prototype stayed behind a feature flag and is omitted.
 */
const PAGE = 8;

const TYPES: Record<string, string> = {
  manual_topup: 'Top-up',
  auto_recharge: 'Auto top-up',
  shortfall_cover: 'Usage charge',
  shortfall_recharge: 'Balance restore',
};

function typeLabel(t: string): string {
  return TYPES[t] ?? t.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function BillingHistory({ ledger, loading }: { ledger: LedgerEntry[] | null; loading: boolean }) {
  const [page, setPage] = useState(0);

  const rows = ledger ?? [];
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE);

  if (loading && shown.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Loading…
      </Typography>
    );
  }
  if (shown.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No transactions yet.
      </Typography>
    );
  }

  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Type</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell align="right">Balance after</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {shown.map((e) => {
            const amt = Number(e.amount_usd);
            const era =
              e.era_id && /^\d+$/.test(e.era_id)
                ? ` · era ${num(Number(e.era_id), 0)}`
                : e.era_id
                  ? ` · era ${e.era_id}`
                  : '';
            return (
              <TableRow key={e.id}>
                <TableCell>{shortDate(e.created_at)}</TableCell>
                <TableCell>
                  {typeLabel(e.entry_type)}
                  <Typography component="span" variant="caption" color="text.secondary">
                    {era}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ color: amt > 0 ? 'success.main' : 'text.primary' }}>
                  {signedMoney(amt)}
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>
                  {money(e.running_balance_usd)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {rows.length > PAGE && (
        <Stack direction="row" alignItems="center" spacing={1} marginTop="12px">
          <Typography variant="caption" color="text.secondary" flex={1}>
            {current * PAGE + 1}–{current * PAGE + shown.length} of {rows.length}
          </Typography>
          <Button size="small" variant="outlined" color="secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Prev
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </Stack>
      )}
    </Box>
  );
}
