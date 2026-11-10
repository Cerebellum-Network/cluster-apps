import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ApiError, newIdempotencyKey, payment, type DeveloperProfile, type TopupResult } from '../api';
import { config } from '../billingConfig';
import { brandName, usd } from '../../lib/format';
import { useRefreshPayments } from '../queries';
import { Alert, Btn, Card, CopyHash, IndeterminateBar, Mono, Overline } from '../../components/ui';

const PRESETS = [10, 25, 50, 100];
const MAX = 1000;
const CHECKOUT_KEY = 'dragon-billing:checkout-amount';

type Status =
  | { kind: 'idle' }
  | { kind: 'confirm' }
  | { kind: 'processing' }
  | { kind: 'ok'; amount: number; funding: TopupResult['chain_funding'] | null; tx?: string }
  | { kind: 'declined' }
  | { kind: 'pending' }
  | { kind: 'failed'; message: string };

/** "$25" for whole amounts, "$25.50" otherwise (the CTA label). */
const ctaAmount = (v: number) => (Number.isInteger(v) ? `$${v.toLocaleString('en-US')}` : usd(v));

function readCheckoutAmount(): number | null {
  try {
    const v = sessionStorage.getItem(CHECKOUT_KEY);
    sessionStorage.removeItem(CHECKOUT_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

/**
 * Billing Payments.dc.html, Top up card. With a saved card the top-up is one
 * off-session charge (POST /topups); without one, or when the person wants a
 * different card, it goes through Stripe Checkout, which charges the amount
 * and saves the card.
 */
export function TopUp({
  account,
  profile,
  newCard,
  onNewCardDone,
}: {
  account: string;
  profile: DeveloperProfile | null | undefined;
  /** "Replace card" / "Use another card": the next top-up goes through Checkout. */
  newCard: boolean;
  onNewCardDone: () => void;
}) {
  const refresh = useRefreshPayments(account);
  const [input, setInput] = useState('25.00');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [redirecting, setRedirecting] = useState(false);
  const idem = useRef<string | null>(null);

  // Back from Stripe Checkout.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const result = q.get('checkout');
    if (!result) return;
    const amount = readCheckoutAmount();
    if (result === 'success' && amount) setStatus({ kind: 'ok', amount, funding: null });
    q.delete('checkout');
    const rest = q.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
    refresh();
    // The card and the balance land when Stripe's webhook arrives; poll briefly.
    const t = setInterval(refresh, 3000);
    const stop = setTimeout(() => clearInterval(t), 30_000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = profile?.has_active_card ? profile.card : null;
  const useCheckout = !card || newCard;
  const amount = Number(input);
  const tooMuch = amount > MAX;
  const valid = input !== '' && Number.isFinite(amount) && amount >= 0.01 && !tooMuch;
  const cardName = card ? `${brandName(card.brand)} ` : '';
  const last4 = card?.last4 ? `•••• ${card.last4}` : '';

  const edit = (next: string) => {
    if (!/^\d{0,4}(\.\d{0,2})?$/.test(next)) return;
    setInput(next);
    if (status.kind !== 'processing') setStatus({ kind: 'idle' });
  };

  const goToCheckout = async () => {
    setRedirecting(true);
    try {
      const url = await payment.checkout(account, amount, `${window.location.origin}/billing/payments`);
      try {
        sessionStorage.setItem(CHECKOUT_KEY, amount.toFixed(2));
      } catch {
        /* the success message falls back to a refresh */
      }
      window.location.assign(url);
    } catch (e) {
      setRedirecting(false);
      setStatus({ kind: 'failed', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const charge = async () => {
    setStatus({ kind: 'processing' });
    idem.current ??= newIdempotencyKey();
    try {
      const r = await payment.topUp(account, amount, idem.current);
      idem.current = null;
      setStatus(r.status === 'pending' ? { kind: 'pending' } : { kind: 'ok', amount: Number(r.amount_usd), funding: r.chain_funding });
      refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        idem.current = null;
        setStatus({ kind: 'declined' });
      } else {
        // Network or server trouble: keep the key so a retry cannot double-charge.
        setStatus({ kind: 'failed', message: e instanceof Error ? e.message : String(e) });
      }
    }
  };

  const presetStyle = (p: number): CSSProperties => {
    const on = valid && amount === p;
    return {
      textAlign: 'center',
      font: '500 14px/1 var(--font-mono)',
      padding: '14px 0',
      borderRadius: 12,
      border: `1px solid ${on ? 'var(--b-acc)' : 'var(--b-line2)'}`,
      background: on ? 'var(--b-acc-soft)' : 'transparent',
      color: on ? 'var(--b-acc-tx)' : 'var(--b-tx)',
      cursor: 'pointer',
    };
  };

  return (
    <Card id="top-up" style={{ gap: 16, scrollMarginTop: 16 }}>
      <Overline>Top up</Overline>
      <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--b-tx2)', marginTop: -8 }}>
        One balance pays for both storage and inference. Inference stops when it runs out.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
        {PRESETS.map((p) => (
          <button key={p} type="button" style={presetStyle(p)} onClick={() => edit(p.toFixed(2))} aria-pressed={valid && amount === p}>
            ${p}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label
          htmlFor="topup-amount"
          style={{ font: '500 12px/1 var(--font-sans)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--b-tx2)' }}
        >
          Custom amount
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '12px 14px',
            border: `1px solid ${tooMuch ? 'var(--b-err-tx)' : 'var(--b-line2)'}`,
            borderRadius: 12,
            background: 'var(--b-card)',
          }}
        >
          <span style={{ font: '500 16px/1 var(--font-mono)', color: 'var(--b-tx3)' }}>$</span>
          <input
            id="topup-amount"
            inputMode="decimal"
            autoComplete="off"
            value={input}
            onChange={(e) => edit(e.target.value)}
            onBlur={() => valid && setInput(amount.toFixed(2))}
            style={{
              font: '500 16px/1 var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              flex: 1,
              minWidth: 0,
              border: 0,
              outline: 0,
              padding: 0,
              background: 'transparent',
              color: 'var(--b-tx)',
            }}
          />
        </div>
        <div style={{ font: '400 11px/1.4 var(--font-mono)', color: tooMuch ? 'var(--b-err-tx)' : 'var(--b-tx3)' }}>
          {tooMuch ? 'Maximum top-up is $1,000.00' : 'Up to $1,000.00, two decimals'}
        </div>
      </div>

      {status.kind === 'idle' && (
        <>
          <Btn variant="primary" size="lg" disabled={!valid || redirecting} onClick={useCheckout ? goToCheckout : () => setStatus({ kind: 'confirm' })}>
            {useCheckout ? 'Continue to payment' : `Top up ${valid ? ctaAmount(amount) : ''}`.trim()}
          </Btn>
          {useCheckout && !(newCard && card) && (
            <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--b-tx2)' }}>
              You pay on Stripe Checkout. The card is saved for your next top-up.
            </div>
          )}
          {newCard && card && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 12, background: 'var(--b-chip)' }}>
              <div style={{ font: '500 14px/1.4 var(--font-sans)' }}>Pay with a new card</div>
              <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--b-tx2)' }}>
                Choose an amount, then continue to Stripe Checkout to enter the card. Stripe charges the amount and the new card
                replaces {cardName}
                <Mono>{last4}</Mono> for later top-ups.
              </div>
              <Btn variant="tertiary" style={{ font: '500 14px/1 var(--font-sans)', padding: '8px 0', alignSelf: 'flex-start' }} onClick={onNewCardDone}>
                Keep {cardName}
                {last4}
              </Btn>
            </div>
          )}
          {redirecting && <IndeterminateBar height={3} seconds={1.2} />}
        </>
      )}

      {status.kind === 'confirm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16, borderRadius: 12, background: 'var(--b-chip)' }}>
          <div style={{ font: '500 15px/1.4 var(--font-sans)' }}>
            Charge <Mono>{usd(amount)}</Mono> to {cardName}
            <Mono>{last4}</Mono>?
          </div>
          <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--b-tx2)' }}>
            The amount is added to your balance, then funds your DDC deposit on chain.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Btn variant="tertiary" style={{ font: '500 14px/1 var(--font-sans)', padding: '12px 16px' }} onClick={() => setStatus({ kind: 'idle' })}>
              Cancel
            </Btn>
            <Btn variant="primary" style={{ font: '500 14px/1 var(--font-sans)', letterSpacing: '.5px', padding: '12px 16px' }} onClick={charge}>
              Charge {usd(amount)}
            </Btn>
          </div>
        </div>
      )}

      {status.kind === 'processing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 12, background: 'var(--b-chip)' }}>
          <div style={{ font: '500 14px/1.4 var(--font-sans)' }}>
            Charging {cardName}
            <Mono>{last4}</Mono>…
          </div>
          <IndeterminateBar height={4} seconds={1.2} />
        </div>
      )}

      {status.kind === 'ok' && (
        <Alert
          tone="ok"
          title={
            <>
              <Mono>{usd(status.amount)}</Mono> added.
            </>
          }
        >
          {fundingLine(status.funding, status.tx)}
        </Alert>
      )}

      {status.kind === 'declined' && (
        <Alert
          tone="err"
          title="Your card was declined"
          action={
            <Btn
              variant="banner"
              size="xs"
              onClick={() => {
                setStatus({ kind: 'idle' });
                goToCheckout();
              }}
            >
              Use another card
            </Btn>
          }
        >
          Nothing was charged.
        </Alert>
      )}

      {status.kind === 'pending' && (
        <Alert tone="warn" title="Pending at the card provider">
          Your bank is still confirming the charge. The balance updates when it clears.
        </Alert>
      )}

      {status.kind === 'failed' && (
        <Alert
          tone="err"
          title="The top-up didn't go through"
          action={
            <Btn variant="banner" size="xs" onClick={() => setStatus({ kind: 'idle' })}>
              Try again
            </Btn>
          }
        >
          {status.message}
        </Alert>
      )}
    </Card>
  );
}

/**
 * The second line of the success alert. "Sent on chain" needs the funding
 * transaction, which payment-service does not return yet (feature flag).
 */
function fundingLine(funding: TopupResult['chain_funding'] | null, tx?: string) {
  if (funding === 'sent' && config.features.chainStatus) {
    return tx ? (
      <>
        Sent on chain · <CopyHash hash={tx} color="currentColor" />
      </>
    ) : (
      'Sent on chain.'
    );
  }
  if (funding === 'disabled' || funding === 'not_recorded' || funding === 'failed') return null;
  return 'Funding your DDC deposit…';
}
