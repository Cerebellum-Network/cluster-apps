import {
  Box,
  Typography,
  Stack,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@cluster-apps/ui';
import { useMemo, useState } from 'react';

import type { LedgerEntry } from '~/billing/api';
import { num, shortDate, signedUsd, usdBalance } from '~/billing/format';

/**
 * Payment history, ported from billing-console (pages/payments/History.tsx). The
 * ledger endpoint has no type filter or server paging for this view, so the full
 * ledger is loaded once (useLedger) and filtered + paged here. The on-chain
 * status column from the prototype stayed behind a feature flag and is omitted.
 */
const PAGE = 8;

const TYPES: Record<string, string> = {
  manual_topup: 'Top-up',
  auto_recharge: 'Auto top-up',
  shortfall_cover: 'Usage charge',
  shortfall_recharge: 'Balance restore',
};
const FILTERS = ['All', 'Top-up', 'Auto top-up', 'Usage charge', 'Balance restore'] as const;
type Filter = (typeof FILTERS)[number];

function typeLabel(t: string): string {
  return TYPES[t] ?? t.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function BillingHistory({ ledger, loading }: { ledger: LedgerEntry[] | null; loading: boolean }) {
  const [filter, setFilter] = useState<Filter>('All');
  const [page, setPage] = useState(0);

  const rows = useMemo(
    () => (ledger ?? []).filter((e) => filter === 'All' || typeLabel(e.entry_type) === filter),
    [ledger, filter],
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE);

  return (
    <Box>
      <Typography variant="subtitle1" marginBottom="12px">
        Payment history
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" marginBottom="12px" useFlexGap>
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="small"
            variant={f === filter ? 'contained' : 'outlined'}
            color="secondary"
            onClick={() => {
              setFilter(f);
              setPage(0);
            }}
          >
            {f}
          </Button>
        ))}
      </Stack>

      {loading && shown.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      ) : shown.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {filter === 'All' ? 'No payments yet.' : `No ${filter.toLowerCase()} entries yet.`}
        </Typography>
      ) : (
        <>
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
                  e.era_id && /^\d+$/.test(e.era_id) ? ` · era ${num(Number(e.era_id), 0)}` : e.era_id ? ` · era ${e.era_id}` : '';
                return (
                  <TableRow key={e.id}>
                    <TableCell>{shortDate(e.created_at)}</TableCell>
                    <TableCell>
                      {typeLabel(e.entry_type)}
                      <Typography component="span" variant="caption" color="text.secondary">
                        {era}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ color: amt > 0 ? 'var(--b-ok-tx)' : 'var(--b-tx)' }}>
                      {signedUsd(amt)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'var(--b-tx-dim)' }}>
                      {usdBalance(e.running_balance_usd)}
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
        </>
      )}
    </Box>
  );
}
