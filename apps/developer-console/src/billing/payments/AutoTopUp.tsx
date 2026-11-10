import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { payment, type DeveloperProfile, type LedgerEntry } from '../api';
import { brandName, longDate, usd } from '../../lib/format';
import { keys } from '../queries';
import { Card, Mono, Overline, StatusPill, Toggle } from '../../components/ui';

const DEFAULT_THRESHOLD = 10;
const DEFAULT_AMOUNT = 20;

/** "$10" for whole amounts, "$12.50" otherwise. */
const plain = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

/** Billing Payments.dc.html, Auto top-up card. */
export function AutoTopUp({
  account,
  profile,
  ledger,
}: {
  account: string;
  profile: DeveloperProfile | null | undefined;
  ledger: LedgerEntry[] | undefined;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCard = !!profile?.has_active_card;
  const threshold = profile?.auto_recharge_threshold_usd == null ? null : Number(profile.auto_recharge_threshold_usd);
  const amount = profile?.auto_recharge_amount_usd == null ? null : Number(profile.auto_recharge_amount_usd);
  const on = hasCard && threshold != null && amount != null;
  const card = profile?.card;
  const lastCharge = ledger?.find((e) => e.entry_type === 'auto_recharge');

  const save = async (fn: () => Promise<DeveloperProfile>) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await fn();
      qc.setQueryData(keys.profile(account), updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card id="auto-top-up" style={{ gap: 16, scrollMarginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Overline style={{ flex: 1 }}>Auto top-up</Overline>
        <span style={{ font: '500 13px/1 var(--font-sans)', color: on ? 'var(--b-ok-tx)' : 'var(--b-tx3)' }}>{on ? 'On' : 'Off'}</span>
        <Toggle
          label="Auto top-up"
          checked={on}
          disabled={!hasCard || saving}
          onChange={(next) =>
            save(() =>
              next
                ? payment.setAutoTopUp(account, threshold ?? DEFAULT_THRESHOLD, amount ?? DEFAULT_AMOUNT)
                : payment.disableAutoTopUp(account),
            )
          }
        />
      </div>

      {on ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, font: '400 15px/1.4 var(--font-sans)' }}>
            <span>When my balance falls below</span>
            <MoneyInput
              key={`t${threshold}`}
              label="Threshold"
              value={threshold!}
              disabled={saving}
              onCommit={(v) => save(() => payment.setAutoTopUp(account, v, amount!))}
            />
            <span>add</span>
            <MoneyInput key={`a${amount}`} label="Amount" value={amount!} disabled={saving} onCommit={(v) => save(() => payment.setAutoTopUp(account, threshold!, v))} />
          </div>
          <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--b-tx2)' }}>
            Checked after each settled period and once a day. Charges {brandName(card?.brand)}
            {card?.last4 ? ` •••• ${card.last4}` : ''}.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, borderTop: '1px solid var(--b-line)' }}>
            <div style={{ font: '500 12px/1 var(--font-sans)', color: 'var(--b-tx3)' }}>Last automatic charge</div>
            {lastCharge ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', font: '400 13px/1.3 var(--font-sans)' }}>
                <Mono>{longDate(lastCharge.created_at)}</Mono>
                <Mono>{usd(Number(lastCharge.amount_usd))}</Mono>
                <StatusPill tone="ok">Succeeded</StatusPill>
              </div>
            ) : (
              <div style={{ font: '400 13px/1.3 var(--font-sans)', color: 'var(--b-tx3)' }}>None yet</div>
            )}
          </div>
        </>
      ) : (
        <div style={{ padding: 16, borderRadius: 12, background: 'var(--b-chip)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ font: '500 14px/1.3 var(--font-sans)' }}>Auto top-up is off</span>
          <span style={{ font: '400 13px/1.5 var(--font-sans)', color: 'var(--b-tx2)' }}>
            {hasCard
              ? "Your balance won't be refilled automatically. Turn it on to top up when the balance runs low."
              : 'Add a card to turn on auto top-up.'}
          </span>
        </div>
      )}
      {error && <div style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--b-err-tx)' }}>{error}</div>}
    </Card>
  );
}

/** Inline mono amount box ("$10"): saves on blur or Enter. */
function MoneyInput({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onCommit: (v: number) => void;
}) {
  // Keyed on `value` by the caller, so a saved value resets the text.
  const [text, setText] = useState(plain(value));

  const commit = () => {
    const v = Number(text);
    if (!text || !Number.isFinite(v) || v <= 0 || v > 1000) {
      setText(plain(value));
      return;
    }
    const rounded = Math.round(v * 100) / 100;
    if (rounded !== value) onCommit(rounded);
    else setText(plain(value));
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        font: '500 15px/1 var(--font-mono)',
        padding: '10px 12px',
        border: '1px solid var(--b-line2)',
        borderRadius: 12,
        minWidth: 64,
      }}
    >
      $
      <input
        aria-label={label}
        inputMode="decimal"
        value={text}
        disabled={disabled}
        onChange={(e) => /^\d{0,4}(\.\d{0,2})?$/.test(e.target.value) && setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        size={Math.max(2, text.length)}
        style={{
          font: 'inherit',
          fontVariantNumeric: 'tabular-nums',
          border: 0,
          outline: 0,
          padding: 0,
          background: 'transparent',
          color: 'var(--b-tx)',
          width: `${Math.max(2, text.length)}ch`,
        }}
      />
    </span>
  );
}
