import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { config } from '../billingConfig';
import { usd } from '../../lib/format';
import { burnPerDay } from '../model';
import { useBalance, useBills, useLedger, useProfile } from '../queries';
import { useSession } from '../../wallet/session';
import type { DeveloperProfile } from '../api';
import { Btn, Card, MessageCard, Mono, Overline, Skel } from '../../components/ui';
import { AutoTopUp } from './AutoTopUp';
import { CardBrand } from './CardBrand';
import { History } from './History';
import { TopUp } from './TopUp';

/** Billing Payments.dc.html */
export function Payments() {
  const s = useSession();
  const account = s.account!;
  const profile = useProfile(account);
  const balance = useBalance(account);
  const ledger = useLedger(account);
  const bills = useBills(account);
  const [newCard, setNewCard] = useState(false);
  // Bumped on every Add/Replace card click: remounts the Top up card, so it
  // leaves a finished state ("$25.00 added.", confirm, declined) for its start.
  const [newCardRequest, setNewCardRequest] = useState(0);
  const { hash } = useLocation();

  // Banner actions link to #top-up and #auto-top-up.
  useEffect(() => {
    if (!hash || profile.isLoading) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, profile.isLoading]);

  if (profile.isError || balance.isError) {
    return (
      <MessageCard
        glyph="!"
        iconBg="var(--b-err-bg)"
        iconTx="var(--b-err-tx)"
        title="Could not load your payments."
        body="The payment service did not respond. Your balance and usage are not affected."
        cta="Retry"
        onCta={() => {
          void profile.refetch();
          void balance.refetch();
          void ledger.refetch();
        }}
      />
    );
  }

  // A developer card is saved only with a charge (Stripe Checkout), so adding
  // or replacing one means a top-up on a new card: switch the Top up card to
  // that, back at its start, and bring it into view.
  const chooseCard = () => {
    setNewCard(true);
    setNewCardRequest((n) => n + 1);
    requestAnimationFrame(() => {
      document.getElementById('top-up')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('topup-amount')?.focus({ preventScroll: true });
    });
  };

  const perDay = bills.data ? burnPerDay(bills.data) : null;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
        <Card style={{ gap: 14 }}>
          <Overline>Balance</Overline>
          {balance.data == null ? (
            <Skel w="60%" h={40} r={8} />
          ) : (
            <Mono style={{ font: '600 40px/1 var(--font-mono)', letterSpacing: '-0.02em' }}>{usd(balance.data)}</Mono>
          )}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              paddingTop: 12,
              borderTop: '1px solid var(--b-line)',
              font: '400 13px/1.4 var(--font-sans)',
              color: 'var(--b-tx2)',
            }}
          >
            {config.features.chainDeposit && (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ flex: 1 }}>DDC deposit on chain</span>
                  <Mono style={{ color: 'var(--b-tx)' }}>—</Mono>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ flex: 1 }}>Oracle rate</span>
                  <Mono>—</Mono>
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ flex: 1 }}>Burn rate</span>
              {perDay == null ? (
                <Mono>—</Mono>
              ) : (
                <span>
                  about <Mono style={{ color: 'var(--b-tx)' }}>{usd(perDay)}</Mono> / day
                </span>
              )}
            </div>
          </div>
        </Card>
        <PaymentMethod profile={profile.data} loading={profile.isLoading} onChoose={chooseCard} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, alignItems: 'start' }}>
        <TopUp
          key={newCardRequest}
          account={account}
          profile={profile.data}
          newCard={newCard}
          onNewCardDone={() => setNewCard(false)}
        />
        <AutoTopUp account={account} profile={profile.data} ledger={ledger.data} />
      </div>

      <History ledger={ledger.data} loading={ledger.isLoading} />
    </>
  );
}

function PaymentMethod({
  profile,
  loading,
  onChoose,
}: {
  profile: DeveloperProfile | null | undefined;
  loading: boolean;
  onChoose: () => void;
}) {
  const card = profile?.has_active_card ? profile.card : null;
  const btn = { font: '500 14px/1 var(--font-sans)', letterSpacing: '.5px', padding: '10px 14px' };
  const exp =
    card?.exp_month && card.exp_year ? `Exp ${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}` : null;

  return (
    <Card style={{ gap: 14 }}>
      <Overline>Payment method</Overline>
      {loading ? (
        <Skel w="100%" h={62} r={12} />
      ) : card ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, border: '1px solid var(--b-line)', flexWrap: 'wrap' }}>
          <CardBrand brand={card.brand} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
            <Mono style={{ font: '500 15px/1 var(--font-mono)' }}>•••• {card.last4 ?? '····'}</Mono>
            {exp && <Mono style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--b-tx3)' }}>{exp}</Mono>}
          </div>
          <Btn variant="secondary" style={btn} onClick={onChoose}>
            Replace card
          </Btn>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 16,
            borderRadius: 12,
            border: '1px dashed var(--b-line2)',
            alignItems: 'flex-start',
          }}
        >
          <span style={{ font: '500 15px/1.3 var(--font-sans)' }}>No card on file</span>
          <span style={{ font: '400 13px/1.5 var(--font-sans)', color: 'var(--b-tx2)' }}>Your first top-up saves the card for next time.</span>
          <Btn variant="secondary" style={btn} onClick={onChoose}>
            Add a card
          </Btn>
        </div>
      )}
    </Card>
  );
}
