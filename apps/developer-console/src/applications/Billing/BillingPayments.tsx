import { Box, Typography, Stack, Button, LoadingButton, TextField, Alert, styled } from '@cluster-apps/ui';
import { Link } from '@mui/material';
import { useEffect, useState } from 'react';

import { ApiError, isUnconfirmed, toCents, type Account, type Payment } from '~/billing/api';
import { saveCheckoutAmount } from '~/billing/checkout';
import { usePaymentApi } from '~/billing/useBilling';
import { brandName, usd, longDate } from '~/billing/format';
import { ComingSoon, Pill } from '~/components';
import { color, text } from '~/theme/tokens';

/**
 * Top-up and auto-top-up, ported from billing-console (pages/payments/{TopUp,
 * AutoTopUp}.tsx) and rebuilt on @cluster-apps/ui, on payment-service's one
 * top-up call (POST …/topups):
 *  - With a saved card, a top-up is one off-session charge with an idempotency
 *    key held across retries, so a network failure cannot double-charge; a 402
 *    card_declined reads as "declined", nothing charged.
 *  - Without a card (or "pay with a different card", `new_card`) the service
 *    answers with a Stripe Checkout URL, which charges the amount and saves the
 *    card; so does a saved-card charge the bank wants confirmed (3-D Secure).
 *    Any answer with a `checkout_url` is a redirect; on return the page carries
 *    `?checkout=success` and polls the reload briefly.
 *  - Auto-top-up needs a card; defaults $10 threshold / $20 amount. A declined
 *    card or a bank asking the cardholder pauses it; saving the settings resumes.
 */
const PRESETS = [10, 25, 50, 100];

/** Why auto top-up stopped (Account.auto_topup.paused); saving the settings resumes it. */
const PAUSED: Record<NonNullable<Account['auto_topup']>['paused'] & string, string> = {
  declined: 'Paused: the last automatic charge was declined. Replace the card or resume to try it again.',
  requires_action: 'Paused: your bank asked to confirm an automatic charge. Top up once by card, then resume.',
  cap: 'Paused: a spending cap was reached. Resume to charge again.',
};
const MAX = 1000;
const DEFAULT_THRESHOLD = 10;
const DEFAULT_AMOUNT = 20;

// The same card as Section: 16px radius, the shared border, 18/22 padding.
const Panel = styled(Box)(() => ({
  border: `1px solid ${color.border}`,
  borderRadius: 16,
  backgroundColor: color.surface,
  padding: '18px 22px',
}));

type TopUpStatus =
  | { kind: 'idle' }
  | { kind: 'processing' }
  /** Paid; the on-chain deposit follows. */
  | { kind: 'ok'; amount: number }
  | { kind: 'declined' }
  /** Accepted by Stripe, not settled yet. */
  | { kind: 'pending'; amount: number }
  /** No answer or a 5xx: it may have been charged. */
  | { kind: 'unconfirmed' }
  | { kind: 'failed'; message: string };

export function BillingPayments({
  account,
  profile,
  payments,
  balance,
  onPaid,
  onCancel,
  idemKeyFor,
  clearIdem,
}: {
  /** Lowercase-hex, no 0x — the recon/payment account key. */
  account: string;
  profile: Account | null;
  payments: Payment[] | null;
  /** Current balance in USD, for the "Balance after" preview; null while loading. */
  balance: number | null;
  /** Reload balance + profile + payments after a charge or a settings change. */
  onPaid: () => void;
  /** Close the Add funds dialog (the Cancel button). */
  onCancel: () => void;
  /** Idempotency key for a top-up of `amount` (and `newCard`), held by the page
   *  so it survives this dialog closing; tied to the request body. */
  idemKeyFor: (amount: number, newCard: boolean) => string;
  /** Drops the held key after a definite outcome (success / declined). */
  clearIdem: () => void;
}) {
  const api = usePaymentApi();
  const card = profile?.card ?? null;
  const [newCard, setNewCard] = useState(false);
  const useCheckout = !card || newCard;

  // ── Top up ────────────────────────────────────────────────────────────────
  const [input, setInput] = useState('25.00');
  const [status, setStatus] = useState<TopUpStatus>({ kind: 'idle' });
  const [redirecting, setRedirecting] = useState(false);

  const amount = Number(input);
  const tooMuch = amount > MAX;
  const valid = input !== '' && Number.isFinite(amount) && amount >= 0.01 && !tooMuch;

  const edit = (next: string) => {
    if (!/^\d{0,4}(\.\d{0,2})?$/.test(next)) return;
    setInput(next);
    if (status.kind !== 'processing') setStatus({ kind: 'idle' });
  };

  const topUp = async () => {
    const withNewCard = !!card && newCard;
    if (useCheckout) setRedirecting(true);
    else setStatus({ kind: 'processing' });
    // The key is held by the page and tied to this body, so a retry after a
    // network failure reuses it and cannot double-charge.
    const key = idemKeyFor(amount, withNewCard);
    try {
      const p = await api.topUp(account, toCents(amount), withNewCard, key);
      if (p.checkout_url) {
        // Checkout: the amount is charged on Stripe's page (also when the bank
        // wants a saved-card charge confirmed). The return lands on the page.
        saveCheckoutAmount(amount);
        window.location.assign(p.checkout_url);
        return;
      }
      clearIdem();
      setRedirecting(false);
      const paid = p.amount_cents / 100;
      if (p.status === 'succeeded') setStatus({ kind: 'ok', amount: paid });
      else if (p.status === 'processing') setStatus({ kind: 'pending', amount: paid });
      else setStatus({ kind: 'failed', message: p.failure ?? `the payment is ${p.status.replace(/_/g, ' ')}` });
      onPaid();
    } catch (e) {
      setRedirecting(false);
      if (e instanceof ApiError && (e.code === 'card_declined' || e.status === 402)) {
        clearIdem();
        setStatus({ kind: 'declined' });
      } else {
        // Keep the idempotency key so a retry cannot double-charge.
        setStatus(isUnconfirmed(e) ? { kind: 'unconfirmed' } : { kind: 'failed', message: e instanceof Error ? e.message : String(e) });
      }
    }
  };

  const cardLabel = card ? `${brandName(card.brand)}${card.last4 ? ` ···· ${card.last4}` : ''}` : '';

  // ── Auto top-up ─────────────────────────────────────────────────────────────
  const hasCard = !!card;
  const auto = profile?.auto_topup ?? null;
  const atThreshold = auto ? auto.threshold_cents / 100 : null;
  const atAmount = auto ? auto.amount_cents / 100 : null;
  const autoOn = hasCard && auto != null;
  const paused = autoOn ? auto.paused : null;
  const lastAuto = payments?.find((p) => p.kind === 'topup_auto' && p.status === 'succeeded');

  const [thr, setThr] = useState('');
  const [amt, setAmt] = useState('');
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoErr, setAutoErr] = useState<string | null>(null);

  useEffect(() => {
    setThr(atThreshold != null ? String(atThreshold) : String(DEFAULT_THRESHOLD));
    setAmt(atAmount != null ? String(atAmount) : String(DEFAULT_AMOUNT));
  }, [atThreshold, atAmount]);

  const saveAuto = async (fn: () => Promise<Account>) => {
    setAutoSaving(true);
    setAutoErr(null);
    try {
      await fn();
      onPaid();
    } catch (e) {
      setAutoErr(e instanceof Error ? e.message : String(e));
    } finally {
      setAutoSaving(false);
    }
  };

  const thrNum = Number(thr);
  const amtNum = Number(amt);
  const autoValid =
    Number.isFinite(thrNum) && thrNum > 0 && thrNum <= MAX && Number.isFinite(amtNum) && amtNum > 0 && amtNum <= MAX;

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
      {/* Top up */}
      <Panel flex={1}>
        <Typography component="h3" sx={text.title}>Top up</Typography>
        <Typography sx={{ ...text.secondary, marginTop: '4px' }}>
          One balance pays for both storage and inference.
        </Typography>

        <Stack direction="row" spacing={1} marginTop="16px">
          {PRESETS.map((p) => {
            const selected = valid && amount === p;
            return (
              <Button
                key={p}
                fullWidth
                // A preset is a choice, not the action: the selected one is tinted
                // primary, so "Add $X" stays the card's one filled button.
                variant="outlined"
                color={selected ? 'primary' : 'secondary'}
                aria-pressed={selected}
                onClick={() => edit(p.toFixed(2))}
                sx={selected ? { backgroundColor: color.primaryTint, '&:hover': { backgroundColor: color.primaryTint } } : { borderColor: color.border }}
              >
                ${p}
              </Button>
            );
          })}
        </Stack>

        <TextField
          fullWidth
          label="Custom amount (USD)"
          value={input}
          onChange={(e) => edit(e.target.value)}
          error={tooMuch}
          helperText={tooMuch ? 'Maximum top-up is $1,000.00' : 'Up to $1,000.00, two decimals'}
          inputMode="decimal"
          sx={{ marginTop: '16px' }}
        />

        {valid && balance != null && (
          <Typography variant="caption" color="text.secondary" display="block" marginTop="8px">
            Balance after: {usd(balance + amount)}
          </Typography>
        )}

        {status.kind === 'idle' && (
          <>
            {/* The dialog is the deliberate step, so the amount is charged straight
                from this button — no second confirm (#190 review, board 11). */}
            <Stack direction="row" spacing={1} justifyContent="flex-end" marginTop="16px">
              <Button variant="outlined" color="secondary" onClick={onCancel}>
                Cancel
              </Button>
              <LoadingButton
                variant="contained"
                loading={redirecting}
                disabled={!valid}
                onClick={topUp}
              >
                {useCheckout ? 'Continue to payment' : `Add ${valid ? usd(amount) : ''}`.trim()}
              </LoadingButton>
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" marginTop="8px">
              {useCheckout
                ? card
                  ? 'You pay on Stripe Checkout. The card you pay with becomes your saved card.'
                  : 'You pay on Stripe Checkout. The card is saved for your next top-up.'
                : `Charged to ${cardLabel}, added to your balance.`}
            </Typography>
            <Stack spacing={0.5} marginTop="12px">
              {card && (
                <Link component="button" type="button" variant="caption" onClick={() => setNewCard(!newCard)} sx={{ alignSelf: 'flex-start' }}>
                  {newCard ? `Pay with ${cardLabel} instead` : 'Pay with a different card on Stripe'}
                </Link>
              )}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  Prefer crypto? Deposit CERE
                </Typography>
                <ComingSoon />
              </Stack>
            </Stack>
          </>
        )}

        {status.kind === 'processing' && (
          <LoadingButton variant="contained" fullWidth loading disabled sx={{ marginTop: '16px' }}>
            Charging {cardLabel}…
          </LoadingButton>
        )}

        {status.kind === 'ok' && (
          <Alert severity="success" sx={{ marginTop: '16px' }} onClose={() => setStatus({ kind: 'idle' })}>
            {usd(status.amount)} paid. It reaches your balance in a minute or two.
          </Alert>
        )}
        {status.kind === 'declined' && (
          <Alert severity="error" sx={{ marginTop: '16px' }} onClose={() => setStatus({ kind: 'idle' })}>
            Your card was declined. Nothing was charged.
          </Alert>
        )}
        {status.kind === 'pending' && (
          <Alert severity="warning" sx={{ marginTop: '16px' }} onClose={() => setStatus({ kind: 'idle' })}>
            {usd(status.amount)} is processing at the card provider. The balance updates when it clears.
          </Alert>
        )}
        {status.kind === 'unconfirmed' && (
          <Alert severity="warning" sx={{ marginTop: '16px' }} onClose={() => setStatus({ kind: 'idle' })}>
            We couldn’t confirm the top-up. Check your balance before trying again.
          </Alert>
        )}
        {status.kind === 'failed' && (
          <Alert severity="error" sx={{ marginTop: '16px' }} onClose={() => setStatus({ kind: 'idle' })}>
            The top-up didn't go through: {status.message}
          </Alert>
        )}
      </Panel>

      {/* Auto top-up */}
      <Panel flex={1}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography component="h3" sx={text.title}>Auto top-up</Typography>
          <Pill tone={paused ? 'warning' : autoOn ? 'success' : 'neutral'}>{paused ? 'Paused' : autoOn ? 'On' : 'Off'}</Pill>
        </Stack>

        {!hasCard ? (
          <Typography sx={{ ...text.secondary, marginTop: '4px' }}>
            Add a card (top up once) to turn on auto top-up.
          </Typography>
        ) : (
          <>
            <Typography sx={{ ...text.secondary, marginTop: '4px' }}>
              When the balance falls below the threshold, charge the amount to {cardLabel}.
            </Typography>
            {paused && (
              <Alert severity="warning" sx={{ marginTop: '12px' }}>
                {PAUSED[paused]}
              </Alert>
            )}
            <Stack direction="row" spacing={1} marginTop="16px">
              <TextField
                label="Below (USD)"
                value={thr}
                onChange={(e) => /^\d{0,4}(\.\d{0,2})?$/.test(e.target.value) && setThr(e.target.value)}
                inputMode="decimal"
                size="small"
              />
              <TextField
                label="Add (USD)"
                value={amt}
                onChange={(e) => /^\d{0,4}(\.\d{0,2})?$/.test(e.target.value) && setAmt(e.target.value)}
                inputMode="decimal"
                size="small"
              />
            </Stack>
            <Stack direction="row" spacing={1} marginTop="16px">
              <LoadingButton
                variant="contained"
                loading={autoSaving}
                disabled={!autoValid}
                onClick={() => saveAuto(() => api.setAutoTopUp(account, toCents(thrNum), toCents(amtNum)))}
              >
                {paused ? 'Resume' : autoOn ? 'Update' : 'Turn on'}
              </LoadingButton>
              {autoOn && (
                <LoadingButton
                  variant="outlined"
                  color="secondary"
                  loading={autoSaving}
                  onClick={() => saveAuto(() => api.disableAutoTopUp(account))}
                >
                  Turn off
                </LoadingButton>
              )}
            </Stack>
            {autoOn && (
              <Typography variant="caption" color="text.secondary" display="block" marginTop="12px">
                Last automatic charge:{' '}
                {lastAuto ? `${longDate(lastAuto.created_at)} · ${usd(lastAuto.amount_cents / 100)}` : 'none yet'}
              </Typography>
            )}
            {autoErr && (
              <Typography variant="caption" color="error" display="block" marginTop="8px">
                {autoErr}
              </Typography>
            )}
          </>
        )}
      </Panel>
    </Stack>
  );
}
