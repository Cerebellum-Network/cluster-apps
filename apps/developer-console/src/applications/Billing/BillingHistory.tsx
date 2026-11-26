import { Box, Typography, Stack, Button, Table, TableHead, TableBody, TableRow, TableCell } from '@cluster-apps/ui';
import { useState } from 'react';

import type { Payment } from '~/billing/api';
import { shortDate, money } from '~/billing/format';
import { paymentKindLabel, paymentStatus } from '~/billing/model';
import { Pill } from '~/components';

/**
 * Payments — every top-up, auto top-up and credit from payment-service, newest
 * first, paged. Usage is not a row here: it is billed per month (Bills, and each
 * month's balance box). The status column says whether a paid top-up has reached
 * the balance yet (its on-chain deposit). "Download CSV" sits in the section
 * header.
 */
const PAGE = 8;

export function BillingHistory({ payments, loading }: { payments: Payment[] | null; loading: boolean }) {
  const [page, setPage] = useState(0);

  const rows = payments ?? [];
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
        No payments yet.
      </Typography>
    );
  }

  return (
    <Box>
      <Table
        size="small"
        // Inside a padded card: the outer columns line up with the card title.
        sx={{ '& .MuiTableCell-root:first-of-type': { paddingLeft: 0 }, '& .MuiTableCell-root:last-of-type': { paddingRight: 0 } }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Type</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell align="right">Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {shown.map((p) => {
            const st = paymentStatus(p);
            return (
              <TableRow key={p.id}>
                <TableCell>{shortDate(p.created_at)}</TableCell>
                <TableCell>{paymentKindLabel(p.kind)}</TableCell>
                <TableCell align="right">{money(p.amount_cents / 100)}</TableCell>
                <TableCell align="right" title={p.failure ?? undefined}>
                  <Pill tone={st.tone}>{st.label}</Pill>
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
