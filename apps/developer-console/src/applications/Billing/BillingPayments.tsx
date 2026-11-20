import { Box, Typography, Stack, Button, LoadingButton, TextField, Alert, styled } from '@cluster-apps/ui';
import { useEffect, useState } from 'react';

import { payment, ApiError, type DeveloperProfile, type LedgerEntry, type TopupResult } from '~/billing/api';
import { saveCheckoutAmount } from '~/billing/checkout';
import { brandName, usd, longDate } from '~/billing/format';
import { ComingSoon } from '~/components';

/**
 * Top-up and auto-top-up, ported from billing-console (pages/payments/{TopUp,
 * AutoTopUp}.tsx) and rebuilt on @cluster-apps/ui. Money rules kept verbatim:
 *  - With a saved card, a top-up is one off-session charge (payment.topUp) with
 *    an idempotency key held across retries so a network failure cannot
 *    double-charge; a 402 reads as "declined", nothing charged.
 *  - Without a card (or "use another card"), it goes through Stripe Checkout
 *    (payment.checkout), which charges the amount and saves the card; on return
 *    the page carries `?checkout=success` and we poll the reload briefly.
 *  - Auto-top-up needs a card; defaults $10 threshold / $20 amount.
 */
const PRESETS = [10, 25, 50, 100];
const MAX = 1000;
const DEFAULT_THRESHOLD = 10;
const DEFAULT_AMOUNT = 20;

const Panel = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: theme.palette.background.paper,
  padding: 20,
}));

type TopUpStatus =
  | { kind: 'idle' }
  | { kind: 'processing' }
  | { kind: 'ok'; amount: number }
  | { kind: 'declined' }
  | { kind: 'pending' }
  | { kind: 'failed'; message: string };

export function BillingPayments({
  account,
  profile,
  ledger,
  balance,
  onPaid,
  onCancel,
  idemKeyFor,
  clearIdem,
}: {
  /** Lowercase-hex, no 0x — the recon/payment account key. */
  account: string;
  profile: DeveloperProfile | null;
  ledger: LedgerEntry[] | null;
  /** Current balance in USD, for the "Balance after" preview; null while loading. */
  balance: number | null;
  /** Reload balance + profile + ledger after a charge or a settings change. */
  onPaid: () => void;
  /** Close the Add funds dialog (the Cancel button). */
  onCancel: () => void;
  /** Idempotency key for a card top-up of `amount`, held by the page so it
   *  survives this dialog closing; tied to the amount. */
  idemKeyFor: (amount: number) => string;
  /** Drops the held key after a definite outcome (success / declined). */
  clearIdem: () => void;
}) {
  const card = profile?.has_active_card ? profile.card : null;
  const useCheckout = !card;

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

  const goToCheckout = async () => {
    setRedirecting(true);
    try {
      const url = await payment.checkout(account, amount, `${window.location.origin}/billing`);
      saveCheckoutAmount(amount);
      window.location.assign(url);
    } catch (e) {
      setRedirecting(false);
      setStatus({ kind: 'failed', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const charge = async () => {
    setStatus({ kind: 'processing' });
    // The key is held by the page and tied to this amount, so a retry after a
    // network failure reuses it and cannot double-charge.
    const key = idemKeyFor(amount);
    try {
      const r: TopupResult = await payment.topUp(account, amount, key);
      clearIdem();
      setStatus(r.status === 'pending' ? { kind: 'pending' } : { kind: 'ok', amount: Number(r.amount_usd) });
      onPaid();
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        clearIdem();
        setStatus({ kind: 'declined' });
      } else {
        // Keep the idempotency key so a retry cannot double-charge.
        setStatus({ kind: 'failed', message: e instanceof Error ? e.message : String(e) });
      }
    }
  };

  const cardLabel = card ? `${brandName(card.brand)}${card.last4 ? ` ···· ${card.last4}` : ''}` : '';

  // ── Auto top-up ─────────────────────────────────────────────────────────────
  const hasCard = !!card;
  const atThreshold = profile?.auto_recharge_threshold_usd == null ? null : Number(profile.auto_recharge_threshold_usd);
  const atAmount = profile?.auto_recharge_amount_usd == null ? null : Number(profile.auto_recharge_amount_usd);
  const autoOn = hasCard && atThreshold != null && atAmount != null;
  const lastAuto = ledger?.find((e) => e.entry_type === 'auto_recharge');

  const [thr, setThr] = useState('');
  const [amt, setAmt] = useState('');
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoErr, setAutoErr] = useState<string | null>(null);

  useEffect(() => {
    setThr(atThreshold != null ? String(atThreshold) : String(DEFAULT_THRESHOLD));
    setAmt(atAmount != null ? String(atAmount) : String(DEFAULT_AMOUNT));
  }, [atThreshold, atAmount]);

  const saveAuto = async (fn: () => Promise<DeveloperProfile>) => {
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
        <Typography variant="subtitle1">Top up</Typography>
        <Typography variant="caption" color="text.secondary">
          One balance pays for both storage and inference.
        </Typography>

        <Stack direction="row" spacing={1} marginTop="16px">
          {PRESETS.map((p) => {
            const selected = valid && amount === p;
            return (
              <Button
                key={p}
                fullWidth
                // Selected preset is primary, not black (#190 review).
                variant={selected ? 'contained' : 'outlined'}
                color={selected ? 'primary' : 'secondary'}
                onClick={() => edit(p.toFixed(2))}
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
                onClick={useCheckout ? goToCheckout : charge}
              >
                {useCheckout ? 'Continue to payment' : `Add ${valid ? usd(amount) : ''}`.trim()}
              </LoadingButton>
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" marginTop="8px">
              {useCheckout
                ? 'You pay on Stripe Checkout. The card is saved for your next top-up.'
                : `Charged to ${cardLabel}, added to your balance.`}
            </Typography>
            <Stack spacing={0.5} marginTop="12px">
              {card && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Use another card
                  </Typography>
                  <ComingSoon />
                </Stack>
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
          <LoadingButton fullWidth loading disabled sx={{ marginTop: '16px' }}>
            Charging {cardLabel}…
          </LoadingButton>
        )}

        {status.kind === 'ok' && (
          <Alert severity="success" sx={{ marginTop: '16px' }} onClose={() => setStatus({ kind: 'idle' })}>
            {usd(status.amount)} added.
          </Alert>
        )}
        {status.kind === 'declined' && (
          <Alert severity="error" sx={{ marginTop: '16px' }} onClose={() => setStatus({ kind: 'idle' })}>
            Your card was declined. Nothing was charged.
          </Alert>
        )}
        {status.kind === 'pending' && (
          <Alert severity="warning" sx={{ marginTop: '16px' }} onClose={() => setStatus({ kind: 'idle' })}>
            Pending at the card provider. The balance updates when it clears.
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
          <Typography variant="subtitle1">Auto top-up</Typography>
          <Typography variant="body2" sx={{ color: autoOn ? 'success.main' : 'text.secondary' }}>
            {autoOn ? 'On' : 'Off'}
          </Typography>
        </Stack>

        {!hasCard ? (
          <Typography variant="body2" color="text.secondary" marginTop="12px">
            Add a card (top up once) to turn on auto top-up.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" marginTop="8px">
              When the balance falls below the threshold, charge the amount to {cardLabel}.
            </Typography>
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
                onClick={() =>
                  saveAuto(() => payment.setAutoTopUp(account, Math.round(thrNum * 100) / 100, Math.round(amtNum * 100) / 100))
                }
              >
                {autoOn ? 'Update' : 'Turn on'}
              </LoadingButton>
              {autoOn && (
                <LoadingButton
                  variant="outlined"
                  color="secondary"
                  loading={autoSaving}
                  onClick={() => saveAuto(() => payment.disableAutoTopUp(account))}
                >
                  Turn off
                </LoadingButton>
              )}
            </Stack>
            {autoOn && (
              <Typography variant="caption" color="text.secondary" display="block" marginTop="12px">
                Last automatic charge:{' '}
                {lastAuto ? `${longDate(lastAuto.created_at)} · ${usd(Number(lastAuto.amount_usd))}` : 'none yet'}
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
