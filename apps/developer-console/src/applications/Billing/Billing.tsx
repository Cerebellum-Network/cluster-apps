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
import { Close, KeyboardArrowRight } from '@mui/icons-material';
import { observer } from 'mobx-react-lite';
import { useState, useEffect, useRef, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAccount } from '~/hooks';
import { PageHeader, Section, ComingSoon, Pill } from '~/components';
import { text } from '~/theme/tokens';
import { useBills, useBalance, useProfile, usePayments, useEnsureRegistered } from '~/billing/useBilling';
import { burnPerDay, billSections, balanceBox, monthFunding, paymentsToCsv } from '~/billing/model';
import { money, usd, usdBalance, signedMoney, signedUsd, monthLabel, brandName, runway, shortDate } from '~/billing/format';
import { normalizeAccount, newIdempotencyKey, toCents, type MonthBill } from '~/billing/api';
import { cardReturnStatus, readCardBefore, readCheckoutAmount } from '~/billing/checkout';
import { isBillingConfigured } from '~/billing/billingConfig';
import { BillingPayments } from './BillingPayments';
import { BillingHistory } from './BillingHistory';
import { ReplaceCardDialog } from './ReplaceCardDialog';

/**
 * Billing — one page (mockup board 10): balance, plan and payment method on top,
 * then Bills, one row per month, the open month expanded with its line items.
 * Every number appears once; the KPI cards, the second balance and the separate
 * "Spend by service" block are gone (#190 review). The inline Add funds / history
 * are interim — they become the Add funds dialog and the per-month balance box.
 * Data comes from recon (bills) and payment-service (account, balance, payments).
 */
const Billing = () => {
  const account = useAccount();
  const bills = useBills();
  const balance = useBalance();
  const profile = useProfile();
  const payments = usePayments();
  // Register the account on first visit so a top-up doesn't fail with
  // not_registered (#190 follow-up); the balance reads once it is registered.
  useEnsureRegistered(profile, balance.reload);
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
    payments.reload();
  };

  // Idempotency key for a top-up, held by the page (not the dialog) so closing
  // and reopening Add funds cannot mint a new key for the same charge and
  // double-charge. Tied to the body — editing the amount or switching to a new
  // card starts a fresh key, since payment-service refuses another body under a
  // key — and cleared by the dialog only on a definite outcome.
  const idemRef = useRef<{ cents: number; newCard: boolean; key: string } | null>(null);
  const idemKeyFor = (amt: number, newCard: boolean): string => {
    const cents = toCents(amt);
    if (!idemRef.current || idemRef.current.cents !== cents || idemRef.current.newCard !== newCard) {
      idemRef.current = { cents, newCard, key: newIdempotencyKey() };
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
  // Back from Replace card: the card on file before Stripe (see checkout.ts), until dismissed.
  const [cardReturn, setCardReturn] = useState<{ before: string | null } | null>(null);
  const [pollDone, setPollDone] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const result = q.get('checkout');
    if (!result) return;
    if (result === 'card') setCardReturn({ before: readCardBefore() });
    const paid = result === 'card' ? null : readCheckoutAmount();
    if (result === 'success') setCheckoutOk(paid ?? 0);
    q.delete('checkout');
    const rest = q.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
    reloadPayments();
    const t = setInterval(reloadPayments, 3000);
    const stop = setTimeout(() => {
      clearInterval(t);
      setPollDone(true);
    }, 30_000);
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
    const blob = new Blob([paymentsToCsv(payments.data)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payments.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const card = profile.data?.card ?? null;
  // The new card shows only once the PSP webhook lands: "saving" until the profile has it.
  const cardStatus = cardReturn && cardReturnStatus(cardReturn.before, profile.data ? card : undefined, pollDone);
  const auto = card ? (profile.data?.auto_topup ?? null) : null;
  const autoStatus = !auto
    ? 'Auto top-up off'
    : auto.paused
      ? 'Auto top-up paused'
      : `Auto top-up ${money(auto.amount_cents / 100)} below ${money(auto.threshold_cents / 100)}`;

  const current = bills.data?.current_month;
  // Last day of a YYYY-MM month, for the forecast's "by <date>".
  const monthEnd = (ym: string): Date => {
    const [y, mo] = ym.split('-').map(Number);
    return new Date(Date.UTC(y, mo, 0));
  };
  // One-line summary under each month (mockup): open → "$X so far, about $Y by
  // <month end>" from current_month.forecast_usd (not the month-to-date total at
  // as_of); settled → how the cost was covered, but only once the payments are
  // in, so a loading/failed list doesn't read as "$total from balance".
  const summaryFor = (m: MonthBill): string => {
    if (m.status !== 'settled') {
      const soFar = usd(m.total_usd);
      const forecast = current && current.month === m.month ? current.forecast_usd : null;
      return forecast != null
        ? `${soFar} so far, about ${money(forecast)} by ${shortDate(monthEnd(m.month))}`
        : `${soFar} so far`;
    }
    if (payments.loading || !payments.data) return '';
    const total = Number(m.total_usd);
    if (!(total > 0)) return '';
    const f = monthFunding(payments.data, m.month, total);
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
      />

      {(bills.error || balance.error || profile.error) && (
        <Typography color="error" variant="body2">
          {bills.error ?? balance.error ?? profile.error}
        </Typography>
      )}

      {cardStatus === 'saving' && <Alert severity="info">Card saved, updating…</Alert>}
      {cardStatus === 'updated' && (
        <Alert severity="success" onClose={() => setCardReturn(null)}>
          Card updated. New payments use it.
        </Alert>
      )}
      {cardStatus === 'slow' && (
        <Alert severity="warning" onClose={() => setCardReturn(null)}>
          We’re still saving your card. Refresh in a minute.
        </Alert>
      )}

      {checkoutOk != null && (
        <Alert severity="success" onClose={() => setCheckoutOk(null)}>
          {checkoutOk > 0 ? `${money(checkoutOk)} paid.` : 'Payment received.'} Your balance updates in a minute or two.
        </Alert>
      )}

      {/* Balance / Plan / Payment method: equal-height cards, one title style,
          the action pinned to the bottom so the three line up. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }, gap: '20px' }}>
        <Section title="Balance" fill>
          <Typography sx={{ ...text.amount, fontVariantNumeric: 'tabular-nums' }}>
            {balance.loading && bal == null ? '…' : usdBalance(bal)}
          </Typography>
          <Typography sx={{ ...text.secondary, marginTop: '4px' }}>{runwayText ?? autoStatus}</Typography>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ marginTop: 'auto', paddingTop: '16px' }}>
            <Button variant="outlined" color="secondary" size="small" onClick={() => setAddOpen(true)}>
              Add funds
            </Button>
            {runwayText && <Typography sx={text.secondary}>{autoStatus}</Typography>}
          </Stack>
        </Section>
        <Section title="Plan" actions={<ComingSoon />} fill>
          <Typography sx={text.value}>Pay as you go</Typography>
          <Box sx={{ marginTop: 'auto', paddingTop: '16px' }}>
            <Button variant="outlined" color="secondary" size="small" disabled>
              Change plan
            </Button>
          </Box>
        </Section>
        <Section title="Payment method" fill>
          <Typography sx={text.value}>
            {profile.loading
              ? 'Loading…'
              : card
                ? `${brandName(card.brand)} ···· ${card.last4 ?? '••••'}`
                : 'No card on file'}
          </Typography>
          {card?.exp_month && card.exp_year && (
            <Typography sx={{ ...text.secondary, marginTop: '4px' }}>
              {`Expires ${String(card.exp_month).padStart(2, '0')}/${card.exp_year}`}
            </Typography>
          )}
          {!profile.loading && (
            <Box sx={{ marginTop: 'auto', paddingTop: '16px' }}>
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                disabled={!pubkey}
                onClick={() => setCardOpen(true)}
              >
                {card ? 'Replace card' : 'Add card'}
              </Button>
            </Box>
          )}
        </Section>
      </Box>

      {/* Add funds dialog (mockup board 11). Opened from the balance card; the
          account menu and the low-balance alert deep-link to it (?add=1). */}
      <Dialog open={addOpen && !!pubkey} onClose={closeAdd} maxWidth="md" fullWidth>
        <DialogTitle sx={{ paddingBottom: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            Add funds
            <IconButton size="small" aria-label="Close" onClick={closeAdd}>
              <Close sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {pubkey && (
            <BillingPayments
              account={pubkey}
              profile={profile.data}
              payments={payments.data}
              balance={bal ?? null}
              onPaid={reloadPayments}
              onCancel={closeAdd}
              idemKeyFor={idemKeyFor}
              clearIdem={clearIdem}
            />
          )}
        </DialogContent>
      </Dialog>

      {pubkey && <ReplaceCardDialog open={cardOpen} account={pubkey} card={card} onClose={() => setCardOpen(false)} />}

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
                <TableCell sx={{ width: 40 }} />
                <TableCell>Month</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Total</TableCell>
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
                      {/* The toggle is a real button (keyboard, aria-expanded), like the Usage models table; the row click is a shortcut. */}
                      <TableCell sx={{ paddingRight: 0 }}>
                        <IconButton
                          size="small"
                          aria-expanded={open}
                          aria-label={`${open ? 'Hide' : 'Show'} the ${monthLabel(m.month)} bill`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMonth(open ? null : m.month);
                          }}
                        >
                          <KeyboardArrowRight sx={{ fontSize: 20, transition: 'transform 150ms', transform: open ? 'rotate(90deg)' : 'none' }} />
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{monthLabel(m.month)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {summaryFor(m)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Pill tone={m.status === 'settled' ? 'success' : 'neutral'}>{m.status === 'settled' ? 'Settled' : 'Estimated'}</Pill>
                      </TableCell>
                      <TableCell align="right">{usd(m.total_usd)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={4} sx={{ p: 0, borderBottom: open ? undefined : 'none' }}>
                        <Collapse in={open} unmountOnExit>
                          <Box padding="8px 8px 20px">
                            {m.status !== 'settled' && (
                              <Typography variant="caption" color="text.secondary">
                                Estimated, month in progress
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

                            {/* Balance box: the money in and out this month — top-ups paid
                                (payment-service) and the month's usage (its bill). */}
                            {(() => {
                              const box = balanceBox(payments.data, m.month, Number(m.total_usd));
                              if (!box) return null;
                              const lines: [string, string][] = [
                                ['Top-ups', signedMoney(box.topups)],
                                ['Usage', signedUsd(box.usage)],
                              ];
                              return (
                                <Box marginTop="20px" padding="12px 16px" sx={{ backgroundColor: 'background.default', borderRadius: '8px' }}>
                                  <Typography variant="subtitle2" marginBottom="8px">
                                    Balance
                                  </Typography>
                                  {lines.map(([label, val]) => (
                                    <Stack key={label} direction="row" justifyContent="space-between" sx={{ paddingY: '3px' }}>
                                      <Typography variant="body2" color="text.secondary">
                                        {label}
                                      </Typography>
                                      <Typography variant="body2">{val}</Typography>
                                    </Stack>
                                  ))}
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

      {/* Payments — the per-month balance box covers the per-month view; this is
          every payment, with a CSV export. */}
      <Section
        title="Payments"
        actions={
          <>
            <Button variant="outlined" color="secondary" size="small" onClick={downloadCsv} disabled={!payments.data?.length}>
              Download CSV
            </Button>
            <Button variant="outlined" color="secondary" size="small" disabled>
              PDF
            </Button>
            <ComingSoon />
          </>
        }
      >
        <BillingHistory payments={payments.data} loading={payments.loading} />
      </Section>
    </Stack>
  );
};

export default observer(Billing);
