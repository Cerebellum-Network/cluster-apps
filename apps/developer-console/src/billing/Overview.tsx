import { useNavigate } from 'react-router-dom';
import type { MonthBill } from './api';
import { monthLabel, usd } from '../lib/format';
import { chart, kpis, n, services, type ChartModel, type Kpi } from './model';
import { useBalance, useBills } from './queries';
import { useIsMobile } from '../lib/useIsMobile';
import { useSession } from '../wallet/session';
import { Card, MessageCard, Mono, Overline, Skel, StatusPill, TagPill, TextLink } from '../components/ui';

/** Billing Overview.dc.html */
export function Overview() {
  const s = useSession();
  const navigate = useNavigate();
  const bills = useBills(s.account);
  const balance = useBalance(s.account);

  if (bills.isLoading) return <OverviewSkeleton />;
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

  const data = bills.data!;
  const empty = data.months.length === 0;
  const tiles = kpis(data, balance.data ?? null);

  return (
    <>
      <KpiRow tiles={tiles} />
      {empty ? (
        <MessageCard
          glyph="·"
          iconBg="var(--b-chip)"
          iconTx="var(--b-tx2)"
          title="No settled usage yet"
          body="No settled usage yet. Bills appear after DDC verifies your first era."
          cta="Go to payments"
          onCta={() => navigate('/billing/payments')}
        />
      ) : (
        <>
          <SpendChart model={chart(data)} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
            <ServiceCard bills={data} />
            <LatestBills months={data.months.slice(0, 3)} current={data.current_month.month} />
          </div>
        </>
      )}
    </>
  );
}

function KpiRow({ tiles }: { tiles: Kpi[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
      {tiles.map((k) => (
        <div
          key={k.label}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 16,
            borderRadius: 16,
            border: `1px solid ${k.emphasis ? 'var(--b-acc)' : 'var(--b-line)'}`,
            background: k.emphasis ? 'var(--b-acc-soft)' : 'var(--b-card)',
            minWidth: 0,
          }}
        >
          <Overline>{k.label}</Overline>
          <Mono
            style={{
              font: '600 28px/1.1 var(--font-mono)',
              letterSpacing: '-0.01em',
              color: k.emphasis ? 'var(--b-acc-tx)' : 'var(--b-tx)',
              overflowWrap: 'anywhere',
            }}
          >
            {k.value}
          </Mono>
          <div style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--b-tx2)' }}>
            {k.delta && <span style={{ color: k.deltaColor, fontFamily: 'var(--font-mono)' }}>{k.delta}</span>} {k.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

function path(pts: [number, number][], ymax: number, xdays: number) {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${((p[0] / xdays) * 1000).toFixed(1)} ${(200 - (p[1] / ymax) * 200).toFixed(1)}`).join(' ');
}

function SpendChart({ model: m }: { model: ChartModel }) {
  const mobile = useIsMobile();
  const h = mobile ? 160 : 220;
  return (
    <Card style={{ gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Overline style={{ flex: 1 }}>Spend over time</Overline>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', font: '400 12px/1 var(--font-sans)', color: 'var(--b-tx2)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 2, background: 'var(--b-acc)' }} />
            {m.monthLabel}
          </span>
          {m.forecast && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 16, height: 0, borderTop: '2px dashed var(--b-acc)' }} />
              Forecast
            </span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 2, background: 'var(--b-prev)' }} />
            {m.prevLabel}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: h,
            font: '400 11px/1 var(--font-mono)',
            color: 'var(--b-tx3)',
            textAlign: 'right',
          }}
        >
          {m.yLabels.map((y) => (
            <span key={y}>{y}</span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ position: 'relative', height: h }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              {m.yLabels.map((y) => (
                <div key={y} style={{ borderTop: '1px solid var(--b-line)', height: 0 }} />
              ))}
            </div>
            <svg
              viewBox="0 0 1000 200"
              preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
              role="img"
              aria-label={`Cumulative spend in ${m.monthLabel} against ${m.prevLabel}`}
            >
              <path d={path(m.prev, m.ymax, m.daysInMonth)} fill="none" stroke="var(--b-prev)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              {m.forecast && (
                <path
                  d={path(m.forecast, m.ymax, m.daysInMonth)}
                  fill="none"
                  stroke="var(--b-acc)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <path d={path(m.cur, m.ymax, m.daysInMonth)} fill="none" stroke="var(--b-acc)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
            </svg>
            {m.today && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    top: -6,
                    bottom: 0,
                    left: `${((m.today.x / m.daysInMonth) * 100).toFixed(2)}%`,
                    borderLeft: '1px dashed var(--b-tx3)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${((m.today.x / m.daysInMonth) * 100).toFixed(2)}%`,
                    top: `${(100 - (m.today.y / m.ymax) * 100).toFixed(2)}%`,
                    width: 10,
                    height: 10,
                    margin: '-5px 0 0 -5px',
                    borderRadius: 99,
                    background: 'var(--b-acc)',
                    boxShadow: '0 0 0 3px var(--b-card)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${((m.today.x / m.daysInMonth) * 100).toFixed(2)}%`,
                    top: -6,
                    transform: 'translateX(6px)',
                    font: '500 11px/1 var(--font-sans)',
                    color: 'var(--b-tx2)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.today.label}
                </div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 11px/1 var(--font-mono)', color: 'var(--b-tx3)' }}>
            {m.xLabels.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ServiceCard({ bills }: { bills: Parameters<typeof services>[0] }) {
  const model = services(bills);
  return (
    <Card style={{ gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Overline>Spend by service</Overline>
        {model && <div style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--b-tx3)' }}>{model.note}</div>}
      </div>
      {model?.rows.map((r) => (
        <div key={r.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ font: '500 14px/1.3 var(--font-sans)', flex: 1 }}>{r.name}</span>
            <Mono style={{ font: '500 14px/1 var(--font-mono)' }}>{r.amount}</Mono>
            <Mono style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--b-tx3)', width: 44, textAlign: 'right' }}>{r.pct}</Mono>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'var(--b-chip)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: r.width, background: r.color, borderRadius: 99 }} />
          </div>
        </div>
      ))}
    </Card>
  );
}

export function BillPill({ bill: b }: { bill: MonthBill }) {
  return b.status === 'estimated' ? (
    <StatusPill tone="acc">Estimated</StatusPill>
  ) : (
    <StatusPill tone="ok">Settled</StatusPill>
  );
}

function LatestBills({ months, current }: { months: MonthBill[]; current: string }) {
  const navigate = useNavigate();
  return (
    <Card style={{ gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <Overline style={{ flex: 1 }}>Bills</Overline>
        <TextLink onClick={() => navigate('/billing/bills')}>All bills</TextLink>
      </div>
      {months.map((b) => (
        <div
          key={b.month}
          onClick={() => navigate(`/billing/bills/${b.month}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid var(--b-line)', cursor: 'pointer' }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 14px/1.2 var(--font-sans)' }}>
              {monthLabel(b.month)}
              {b.month === current && <TagPill pad="3px 7px">current</TagPill>}
            </div>
            <BillPill bill={b} />
          </div>
          <Mono style={{ font: '500 15px/1 var(--font-mono)' }}>{usd(n(b.total_usd))}</Mono>
        </div>
      ))}
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRadius: 16, border: '1px solid var(--b-line)', background: 'var(--b-card)' }}
          >
            <Skel w="40%" h={10} />
            <Skel w="70%" h={26} r={6} />
            <Skel w="55%" h={10} />
          </div>
        ))}
      </div>
      <Card style={{ gap: 16 }}>
        <Skel w={140} h={10} />
        <Skel w="100%" h={200} r={8} />
      </Card>
      <Card style={{ gap: 14 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Skel w="30%" h={12} />
            <div style={{ flex: 1 }} />
            <Skel w="15%" h={12} />
          </div>
        ))}
      </Card>
    </>
  );
}
