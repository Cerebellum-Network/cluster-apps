import {
  Box,
  Typography,
  Stack,
  Button,
  IconButton,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Collapse,
  Alert,
} from '@cluster-apps/ui';
import { Dialog, DialogTitle, DialogContent } from '@mui/material';
import { Close } from '@mui/icons-material';
import { observer } from 'mobx-react-lite';
import { useState, useEffect, useRef, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAccount } from '~/hooks';
import { PageHeader, Section, ComingSoon } from '~/components';
import { useBills, useBalance, useProfile, useLedger } from '~/billing/useBilling';
import { burnPerDay, billSections, balanceBox, monthFunding, ledgerToCsv } from '~/billing/model';
import { money, signedMoney, monthLabel, brandName, runway, shortDate } from '~/billing/format';
import { normalizeAccount, newIdempotencyKey, type MonthBill } from '~/billing/api';
import { readCheckoutAmount } from '~/billing/checkout';
import { isBillingConfigured } from '~/billing/billingConfig';
import { BillingPayments } from './BillingPayments';
import { BillingHistory } from './BillingHistory';

/**
 * Billing — one page (mockup board 10): balance, plan and payment method on top,
 * then Bills, one row per month, the open month expanded with its line items.
 * Every number appears once; the KPI cards, the second balance and the separate
 * "Spend by service" block are gone (#190 review). The inline Add funds / history
 * are interim — they become the Add funds dialog and the per-month balance box.
 * Data comes from recon (bills) and payment-service (balance, profile, ledger).
 */
const Billing = () => {
  const account = useAccount();
  const bills = useBills();
  const balance = useBalance();
  const profile = useProfile();
  const ledger = useLedger();
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // The account menu and the low-balance alert deep-link to `/billing?add=1` to
  // open the Add funds dialog directly (#190 review: one dialog, opened from
  // Billing, the account menu and the low-balance warning).
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('add') === '1') setAddOpen(true);
  }, [searchParams]);
  const closeAdd = () => {
    setAddOpen(false);
    if (searchParams.has('add')) {
      searchParams.delete('add');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const reloadPayments = () => {
    balance.reload();
    profile.reload();
    ledger.reload();
  };

  // Idempotency key for a card top-up, held by the page (not the dialog) so
  // closing and reopening Add funds cannot mint a new key for the same charge
  // and double-charge. Tied to the amount — editing it starts a fresh key — and
  // cleared by the dialog only on a definite outcome (success / 402 declined).
  const idemRef = useRef<{ cents: number; key: string } | null>(null);
  const idemKeyFor = (amt: number): string => {
    const cents = Math.round(amt * 100);
    if (!idemRef.current || idemRef.current.cents !== cents) {
      idemRef.current = { cents, key: newIdempotencyKey() };
    }
    return idemRef.current.key;
  };
  const clearIdem = () => {
    idemRef.current = null;
  };

  // Back from Stripe Checkout the page lands on `/billing?checkout=success` with
  // the Add funds dialog closed, so the page — not the dialog, which is
  // unmounted — shows the confirmation and polls the reload while the webhook
  // lands (#190 review).
  const [checkoutOk, setCheckoutOk] = useState<number | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const result = q.get('checkout');
    if (!result) return;
    const paid = readCheckoutAmount();
    if (result === 'success') setCheckoutOk(paid ?? 0);
    q.delete('checkout');
    const rest = q.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
    reloadPayments();
    const t = setInterval(reloadPayments, 3000);
    const stop = setTimeout(() => clearInterval(t), 30_000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // In a build a missing endpoint stays undefined (no silent devnet fallback).
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

  const loading = bills.loading || balance.loading || profile.loading;
  const months = bills.data?.months ?? [];
  const rates = bills.data?.rates ?? null;
  const pubkey = account.account ? normalizeAccount(account.account) : null;
  const perDay = bills.data ? burnPerDay(bills.data) : 0;
  const bal = balance.data;
  const runwayText = bal != null && perDay > 0 ? `${runway(bal, perDay).text} at this month’s use` : null;

  const downloadCsv = () => {
    const blob = new Blob([ledgerToCsv(ledger.data)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'billing-history.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const card = profile.data?.has_active_card ? profile.data.card : null;
  const autoOn = profile.data?.auto_recharge_threshold_usd && profile.data?.auto_recharge_amount_usd;
  const autoStatus = autoOn
    ? `Auto top-up ${money(profile.data!.auto_recharge_amount_usd)} below ${money(profile.data!.auto_recharge_threshold_usd)}`
    : 'Auto top-up off';

  const current = bills.data?.current_month;
  // Last day of a YYYY-MM month, for the forecast's "by <date>".
  const monthEnd = (ym: string): Date => {
    const [y, mo] = ym.split('-').map(Number);
    return new Date(Date.UTC(y, mo, 0));
  };
  // One-line summary under each month (mockup): open → "$X so far, about $Y by
  // <month end>" from current_month.forecast_usd (not the month-to-date total at
  // as_of); settled → how the cost was covered, but only once the ledger is in,
  // so a loading/failed ledger doesn't read as "$total from balance".
  const summaryFor = (m: MonthBill): string => {
    if (m.status !== 'settled') {
      const soFar = money(m.total_usd);
      const forecast = current && current.month === m.month ? current.forecast_usd : null;
      return forecast != null
        ? `${soFar} so far, about ${money(forecast)} by ${shortDate(monthEnd(m.month))}`
        : `${soFar} so far`;
    }
    if (ledger.loading || !ledger.data) return '';
    const f = monthFunding(ledger.data, m.month, Number(m.total_usd));
    if (f.card > 0 && f.fromBalance > 0) return `${money(f.card)} by card, ${money(f.fromBalance)} from balance`;
    if (f.card > 0) return `${money(f.card)} by card`;
    return `${money(f.fromBalance)} from balance`;
  };

  if (!account.account) {
    return (
      <Stack spacing="20px">
        <PageHeader title="Billing" subtitle="US dollars" />
        <Section>
          <Typography color="text.secondary">Sign in to view your billing.</Typography>
        </Section>
      </Stack>
    );
  }

  return (
    <Stack spacing="20px">
      <PageHeader
        title="Billing"
        subtitle="US dollars"
        actions={
          <Button variant="contained" onClick={() => setAddOpen((o) => !o)}>
            Add funds
          </Button>
        }
      />

      {(bills.error || balance.error) && (
        <Typography color="error" variant="body2">
          {bills.error ?? balance.error}
        </Typography>
      )}

      {checkoutOk != null && (
        <Alert severity="success" onClose={() => setCheckoutOk(null)}>
          {checkoutOk > 0 ? `${money(checkoutOk)} added.` : 'Payment received.'} Funding your DDC deposit…
        </Alert>
      )}

      {/* Balance / Plan / Payment method */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing="20px" alignItems="stretch">
        <Box flex={1}>
          <Section>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Balance</Typography>
            <Typography sx={{ fontSize: 32, fontWeight: 700, marginTop: '4px', lineHeight: 1.1 }}>
              {balance.loading && bal == null ? '…' : money(bal)}
            </Typography>
            {runwayText && <Typography sx={{ fontSize: 13, color: 'text.secondary', marginTop: '2px' }}>{runwayText}</Typography>}
            <Stack direction="row" alignItems="center" spacing={1} marginTop="14px">
              <Button variant="contained" size="small" onClick={() => setAddOpen(true)}>
                Add funds
              </Button>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>· {autoStatus}</Typography>
            </Stack>
          </Section>
        </Box>
        <Box flex={1}>
          <Section title="Plan" actions={<ComingSoon />}>
            <Typography sx={{ fontSize: 18, fontWeight: 700 }}>Pay as you go</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', marginTop: '2px' }}>
              Free and Pro plans are on the way.
            </Typography>
            <Button variant="outlined" color="secondary" size="small" disabled sx={{ marginTop: '12px' }}>
              Change plan
            </Button>
          </Section>
        </Box>
        <Box flex={1}>
          <Section title="Payment method">
            <Typography sx={{ fontSize: 18, fontWeight: 700 }}>
              {profile.loading
                ? 'Loading…'
                : card
                  ? `${brandName(card.brand)} ···· ${card.last4 ?? '••••'}`
                  : 'No card on file'}
            </Typography>
            {card && (
              <Stack direction="row" alignItems="center" spacing={1} marginTop="10px">
                <Button variant="outlined" color="secondary" size="small" disabled>
                  Replace
                </Button>
                <ComingSoon />
              </Stack>
            )}
          </Section>
        </Box>
      </Stack>

      {/* Add funds dialog (mockup board 11). Opened from the page header and the
          balance card; the account menu / low-balance alert deep-link to it. */}
      <Dialog open={addOpen && !!pubkey} onClose={closeAdd} maxWidth="md" fullWidth>
        <DialogTitle sx={{ paddingBottom: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            Add funds
            <IconButton size="small" onClick={closeAdd}>
              <Close sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {pubkey && (
            <BillingPayments
              account={pubkey}
              profile={profile.data}
              ledger={ledger.data}
              balance={bal ?? null}
              onPaid={reloadPayments}
              onCancel={closeAdd}
              idemKeyFor={idemKeyFor}
              clearIdem={clearIdem}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Bills, one row per month */}
      <Section title="Bills" flush>
        {loading && months.length === 0 ? (
          <Box display="flex" justifyContent="center" padding="24px">
            <CircularProgress size={24} />
          </Box>
        ) : months.length === 0 ? (
          <Box padding="18px 22px">
            <Typography variant="body2" color="text.secondary">
              No bills yet.
            </Typography>
          </Box>
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
                      <TableCell>
                        <Typography variant="body2">{monthLabel(m.month)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {summaryFor(m)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{m.status}</TableCell>
                      <TableCell align="right">{money(m.total_usd)}</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>
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
                                  sx={{ borderBottom: (theme) => `2px solid ${theme.palette.text.primary}` }}
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
                                    sx={{ borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}
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
                                {sec.title === 'Compute' && (
                                  <Stack direction="row" alignItems="center" spacing={1} paddingTop="8px">
                                    <Typography variant="caption" color="text.secondary">
                                      Per-model breakdown
                                    </Typography>
                                    <ComingSoon />
                                  </Stack>
                                )}
                              </Box>
                            ))}

                            {/* Balance box: the money that moved this month (from the ledger). */}
                            {(() => {
                              const box = balanceBox(ledger.data, m.month);
                              if (!box) return null;
                              const lines: [string, string][] = [
                                ['Opening', money(box.opening)],
                                ['Top-ups', signedMoney(box.topups)],
                                ['Usage', signedMoney(box.usage)],
                                ['Closing', money(box.closing)],
                              ];
                              return (
                                <Box marginTop="20px" padding="12px 16px" sx={{ backgroundColor: 'background.default', borderRadius: '8px' }}>
                                  <Typography variant="subtitle2" marginBottom="8px">
                                    Balance
                                  </Typography>
                                  {lines.map(([label, val], i) => {
                                    const last = i === lines.length - 1;
                                    return (
                                      <Stack
                                        key={label}
                                        direction="row"
                                        justifyContent="space-between"
                                        sx={{ paddingY: '3px', borderTop: last ? (theme) => `1px solid ${theme.palette.divider}` : undefined, marginTop: last ? '4px' : 0, paddingTop: last ? '7px' : '3px' }}
                                      >
                                        <Typography variant="body2" color={last ? 'text.primary' : 'text.secondary'} sx={{ fontWeight: last ? 700 : 400 }}>
                                          {label}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: last ? 700 : 400 }}>
                                          {val}
                                        </Typography>
                                      </Stack>
                                    );
                                  })}
                                </Box>
                              );
                            })()}
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
      </Section>

      {/* All transactions — the per-month balance box covers the per-month view;
          this is the full ledger, with a CSV export. */}
      <Section
        title="All transactions"
        actions={
          <>
            <Button variant="outlined" color="secondary" size="small" onClick={downloadCsv} disabled={!ledger.data?.length}>
              Download CSV
            </Button>
            <Button variant="outlined" color="secondary" size="small" disabled>
              PDF
            </Button>
            <ComingSoon />
          </>
        }
      >
        <BillingHistory ledger={ledger.data} loading={ledger.loading} />
      </Section>
    </Stack>
  );
};

export default observer(Billing);
