import {
  Box,
  Typography,
  Stack,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Collapse,
  styled,
} from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useState, Fragment } from 'react';

import { useAccount } from '~/hooks';
import { PageHeader, Section } from '~/components';
import { useBills, useBalance, useProfile, useLedger } from '~/billing/useBilling';
import { kpis, services, billSections } from '~/billing/model';
import { usd, usdBalance, monthLabel, brandName } from '~/billing/format';
import { normalizeAccount } from '~/billing/api';
import { isBillingConfigured } from '~/billing/billingConfig';
import { BillingPayments } from './BillingPayments';
import { BillingHistory } from './BillingHistory';
import '~/billing/billing.css';

/**
 * Billing overview — the first slice of the billing port (mockup screen #10):
 * balance, plan and payment method up top; the month's KPIs; spend by service;
 * and the per-month bills list. Read-only for now — top-up, auto-recharge, bill
 * detail and per-agent usage are later slices. Data comes from recon
 * (bills) and payment-service (balance, profile) via useBilling, keyed off the
 * connected wallet's public key.
 */
const Panel = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: '#fff',
}));

const Billing = () => {
  const account = useAccount();
  const bills = useBills();
  const balance = useBalance();
  const profile = useProfile();
  const ledger = useLedger();
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  const loading = bills.loading || balance.loading || profile.loading;
  const kpiRows = kpis(bills.data, balance.data);
  const spend = bills.data ? services(bills.data) : null;
  const months = bills.data?.months ?? [];
  const rates = bills.data?.rates ?? null;
  const pubkey = account.account ? normalizeAccount(account.account) : null;
  const reloadPayments = () => {
    balance.reload();
    profile.reload();
    ledger.reload();
  };

  // In a build, a missing billing endpoint stays undefined (no silent devnet
  // fallback), so show "unavailable" rather than devnet balances / payments.
  if (!isBillingConfigured()) {
    return (
      <Stack spacing="20px">
        <PageHeader title="Billing" />
        <Section>
          <Typography variant="subtitle1" marginBottom="4px">
            Billing is unavailable
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Billing isn’t configured for this environment yet. Please check back soon.
          </Typography>
        </Section>
      </Stack>
    );
  }

  const paymentSummary = () => {
    if (profile.loading) return 'Loading…';
    const p = profile.data;
    if (!p || !p.has_active_card || !p.card) return 'No card on file';
    return `${brandName(p.card.brand)} ···· ${p.card.last4 ?? '••••'}`;
  };

  const planSummary = () => {
    const p = profile.data;
    if (p?.auto_recharge_threshold_usd && p?.auto_recharge_amount_usd) {
      return `Auto top-up ${usd(p.auto_recharge_amount_usd)} below ${usd(p.auto_recharge_threshold_usd)}`;
    }
    return 'Pay as you go';
  };

  return (
    <div className="billing-root">
      <Box
        display="flex"
        flexDirection="column"
        border={(theme) => `1px solid ${theme.palette.divider}`}
        borderRadius="12px"
        marginBottom="20px"
      >
        <Box
          padding="34px 32px"
          borderBottom={(theme) => `1px solid ${theme.palette.divider}`}
          display="flex"
          alignItems="baseline"
          justifyContent="space-between"
        >
          <Typography variant="h3">Billing</Typography>
          <Typography variant="body2" color="text.secondary">
            US dollars
          </Typography>
        </Box>

        <Box padding="24px">
          {!account.account ? (
            <Typography color="text.secondary">Sign in to view your billing.</Typography>
          ) : (
            <Stack spacing={3}>
              {/* Balance / plan / payment method */}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Panel flex={1} padding="20px">
                  <Typography variant="body2" color="text.secondary">
                    Balance
                  </Typography>
                  <Typography variant="h2" marginTop="4px">
                    {balance.loading ? '…' : usdBalance(balance.data)}
                  </Typography>
                </Panel>
                <Panel flex={1} padding="20px">
                  <Typography variant="body2" color="text.secondary">
                    Plan
                  </Typography>
                  <Typography variant="h4" marginTop="8px">
                    {planSummary()}
                  </Typography>
                </Panel>
                <Panel flex={1} padding="20px">
                  <Typography variant="body2" color="text.secondary">
                    Payment method
                  </Typography>
                  <Typography variant="h4" marginTop="8px">
                    {paymentSummary()}
                  </Typography>
                </Panel>
              </Stack>

              {(bills.error || balance.error) && (
                <Typography color="error" variant="body2">
                  {bills.error ?? balance.error}
                </Typography>
              )}

              {/* KPIs */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {kpiRows.map((k) => (
                  <Panel key={k.label} flex={1} padding="16px 20px">
                    <Typography variant="body2" color="text.secondary">
                      {k.label}
                    </Typography>
                    <Stack direction="row" alignItems="baseline" spacing={1} marginTop="4px">
                      <Typography variant={k.emphasis ? 'h3' : 'h4'}>{k.value}</Typography>
                      {k.delta && (
                        <Typography variant="body2" sx={{ color: k.deltaColor }}>
                          {k.delta}
                        </Typography>
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {k.sub}
                    </Typography>
                  </Panel>
                ))}
              </Stack>

              {/* Spend by service */}
              {spend && (
                <Panel padding="20px">
                  <Typography variant="subtitle1">Spend by service</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {spend.note}
                  </Typography>
                  <Stack spacing={1.5} marginTop="16px">
                    {spend.rows.map((row) => (
                      <Box key={row.name}>
                        <Stack direction="row" justifyContent="space-between" marginBottom="4px">
                          <Typography variant="body2">{row.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {row.amount} · {row.pct}
                          </Typography>
                        </Stack>
                        <Box height="8px" borderRadius="4px" sx={{ backgroundColor: 'var(--b-line)' }}>
                          <Box
                            height="8px"
                            borderRadius="4px"
                            sx={{ width: row.width, backgroundColor: row.color, transition: 'width .3s' }}
                          />
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Panel>
              )}

              {/* Top up + auto top-up */}
              {pubkey && (
                <BillingPayments account={pubkey} profile={profile.data} ledger={ledger.data} onPaid={reloadPayments} />
              )}

              {/* Bills, one row per month */}
              <Panel padding="20px">
                <Typography variant="subtitle1" marginBottom="8px">
                  Bills
                </Typography>
                {loading && months.length === 0 ? (
                  <Box display="flex" justifyContent="center" padding="24px">
                    <CircularProgress size={24} />
                  </Box>
                ) : months.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No bills yet.
                  </Typography>
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Month</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="right" sx={{ width: 40 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {months.map((m) => {
                        const open = openMonth === m.month;
                        return (
                          <Fragment key={m.month}>
                            <TableRow
                              hover
                              onClick={() => setOpenMonth(open ? null : m.month)}
                              sx={{ cursor: 'pointer', '& > td': { borderBottom: open ? 'none' : undefined } }}
                            >
                              <TableCell>{monthLabel(m.month)}</TableCell>
                              <TableCell sx={{ textTransform: 'capitalize' }}>{m.status}</TableCell>
                              <TableCell align="right">{usd(m.total_usd)}</TableCell>
                              <TableCell align="right" sx={{ color: 'var(--b-tx-dim)' }}>
                                {open ? '▾' : '▸'}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={4} sx={{ p: 0, borderBottom: open ? undefined : 'none' }}>
                                <Collapse in={open} unmountOnExit>
                                  <Box padding="8px 8px 20px">
                                    {m.eras > 0 && (
                                      <Typography variant="caption" color="text.secondary">
                                        {m.status === 'settled'
                                          ? `Settled · ${m.eras} era${m.eras === 1 ? '' : 's'}`
                                          : 'Estimated, month in progress'}
                                      </Typography>
                                    )}
                                    {billSections(m, rates).map((sec) => (
                                      <Box key={sec.title} marginTop="16px">
                                        <Stack
                                          direction="row"
                                          justifyContent="space-between"
                                          alignItems="baseline"
                                          paddingBottom="6px"
                                          sx={{ borderBottom: '2px solid var(--b-tx)' }}
                                        >
                                          <Typography variant="subtitle2">{sec.title}</Typography>
                                          <Typography variant="subtitle2">{sec.amount}</Typography>
                                        </Stack>
                                        {sec.rows.map((r) => (
                                          <Stack
                                            key={r.item}
                                            direction="row"
                                            alignItems="baseline"
                                            spacing={2}
                                            padding="8px 0"
                                            sx={{ borderBottom: '1px solid var(--b-line)' }}
                                          >
                                            <Box flex={2}>
                                              <Typography variant="body2">{r.item}</Typography>
                                              {r.sub && (
                                                <Typography variant="caption" color="text.secondary">
                                                  {r.sub}
                                                </Typography>
                                              )}
                                            </Box>
                                            <Typography variant="body2" color="text.secondary" flex={1.3} textAlign="right">
                                              {r.used}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" flex={1.3} textAlign="right">
                                              {r.rate}
                                            </Typography>
                                            <Typography variant="body2" flex={1} textAlign="right">
                                              {r.amount}
                                            </Typography>
                                          </Stack>
                                        ))}
                                        {sec.note && (
                                          <Typography variant="caption" color="text.secondary" display="block" paddingTop="8px">
                                            {sec.note}
                                          </Typography>
                                        )}
                                      </Box>
                                    ))}
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Panel>

              {/* Payment history */}
              <Panel padding="20px">
                <BillingHistory ledger={ledger.data} loading={ledger.loading} />
              </Panel>
            </Stack>
          )}
        </Box>
      </Box>
    </div>
  );
};

export default observer(Billing);
