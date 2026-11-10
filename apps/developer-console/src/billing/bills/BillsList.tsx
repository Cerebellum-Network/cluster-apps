import { useNavigate } from 'react-router-dom';
import { monthLabel, usd } from '../../lib/format';
import { n, requestsUsd } from '../model';
import { useBills } from '../queries';
import { useIsMobile } from '../../lib/useIsMobile';
import { useSession } from '../../wallet/session';
import { MessageCard, Mono, Overline, Skel, TagPill } from '../../components/ui';
import { BillPill } from '../Overview';
import { styled } from '@mui/material/styles';

const COLS = '1.6fr 1fr repeat(5,minmax(0,1fr))';

const Row = styled('div')({
  display: 'grid',
  gridTemplateColumns: COLS,
  gap: 12,
  alignItems: 'center',
  padding: '14px 20px',
  borderBottom: '1px solid var(--b-line)',
  cursor: 'pointer',
  '&:hover': { background: 'var(--b-chip)' },
});

const cell = { textAlign: 'right', font: '400 13px/1 var(--font-mono)', color: 'var(--b-tx2)' } as const;

/** Billing Bills.dc.html, view = list */
export function BillsList() {
  const s = useSession();
  const navigate = useNavigate();
  const mobile = useIsMobile();
  const bills = useBills(s.account);

  if (bills.isError) {
    return (
      <MessageCard
        glyph="!"
        iconBg="var(--b-err-bg)"
        iconTx="var(--b-err-tx)"
        title="Could not load your bill."
        body="The billing service did not respond. Your balance and usage are not affected."
        cta="Retry"
        onCta={() => void bills.refetch()}
      />
    );
  }
  if (bills.data && bills.data.months.length === 0) {
    return (
      <MessageCard
        glyph="·"
        iconBg="var(--b-chip)"
        iconTx="var(--b-tx2)"
        title="No settled usage yet"
        body="No settled usage yet. Bills appear after DDC verifies your first era."
        cta="Go to payments"
        onCta={() => navigate('/billing/payments')}
      />
    );
  }

  const rows = (bills.data?.months ?? []).map((b) => ({
    month: b.month,
    period: monthLabel(b.month),
    current: b.month === bills.data!.current_month.month,
    pill: <BillPill bill={b} />,
    c: usd(n(b.lines.compute_usd)),
    s: usd(n(b.lines.storage_usd)),
    t: usd(n(b.lines.transfer_usd)),
    r: usd(requestsUsd(b)),
    total: usd(n(b.total_usd)),
  }));

  return (
    <div style={{ borderRadius: 16, border: '1px solid var(--b-line)', background: 'var(--b-card)', overflow: 'hidden' }}>
      <Overline style={{ padding: '20px 20px 12px' }}>Bills</Overline>
      {bills.isLoading &&
        [1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '16px 20px', borderTop: '1px solid var(--b-line)' }}>
            <Skel w="28%" h={12} />
            <div style={{ flex: 1 }} />
            <Skel w="12%" h={12} />
          </div>
        ))}
      {!mobile && rows.length > 0 && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: COLS,
              gap: 12,
              padding: '10px 20px',
              borderBottom: '1px solid var(--b-line)',
              font: '500 12px/1 var(--font-sans)',
              color: 'var(--b-tx3)',
            }}
          >
            <span>Period</span>
            <span>Status</span>
            <span style={{ textAlign: 'right' }}>Compute</span>
            <span style={{ textAlign: 'right' }}>Storage</span>
            <span style={{ textAlign: 'right' }}>Transfer</span>
            <span style={{ textAlign: 'right' }}>Requests</span>
            <span style={{ textAlign: 'right' }}>Total</span>
          </div>
          {rows.map((b) => (
            <Row key={b.month} onClick={() => navigate(`/billing/bills/${b.month}`)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 14px/1.2 var(--font-sans)' }}>
                {b.period}
                {b.current && <TagPill pad="3px 7px">current</TagPill>}
              </span>
              <span>{b.pill}</span>
              <Mono style={cell}>{b.c}</Mono>
              <Mono style={cell}>{b.s}</Mono>
              <Mono style={cell}>{b.t}</Mono>
              <Mono style={cell}>{b.r}</Mono>
              <Mono style={{ textAlign: 'right', font: '600 14px/1 var(--font-mono)' }}>{b.total}</Mono>
            </Row>
          ))}
        </>
      )}
      {mobile &&
        rows.map((b) => (
          <div
            key={b.month}
            onClick={() => navigate(`/billing/bills/${b.month}`)}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', borderTop: '1px solid var(--b-line)', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ font: '500 15px/1.2 var(--font-sans)', flex: 1 }}>{b.period}</span>
              <Mono style={{ font: '600 15px/1 var(--font-mono)' }}>{b.total}</Mono>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{b.pill}</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px 12px',
                font: '400 12px/1.3 var(--font-sans)',
                color: 'var(--b-tx3)',
              }}
            >
              <span>
                Compute <Mono style={{ color: 'var(--b-tx2)' }}>{b.c}</Mono>
              </span>
              <span>
                Storage <Mono style={{ color: 'var(--b-tx2)' }}>{b.s}</Mono>
              </span>
              <span>
                Transfer <Mono style={{ color: 'var(--b-tx2)' }}>{b.t}</Mono>
              </span>
              <span>
                Requests <Mono style={{ color: 'var(--b-tx2)' }}>{b.r}</Mono>
              </span>
            </div>
          </div>
        ))}
    </div>
  );
}
