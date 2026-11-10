import { useNavigate, useParams } from 'react-router-dom';
import type { MonthBill, Rates } from '../api';
import { GIB, monthLabel, num, short, usd } from '../../lib/format';
import { n, requestsUsd } from '../model';
import { useBills } from '../queries';
import { useIsMobile } from '../../lib/useIsMobile';
import { useSession } from '../../wallet/session';
import { Card, MessageCard, Mono, Overline, Skel, StatusPill } from '../../components/ui';
import { AgentUsage } from './AgentUsage';

interface LineRow {
  item: string;
  sub: string;
  used: string;
  rate: string;
  amount: string;
}
interface Section {
  title: string;
  amount: string;
  rows: LineRow[];
  note?: string;
}

const perUnit = (price: number, unit: string, scale = 1) => `${usd(price * scale)} / ${unit}`;

/**
 * The rate behind a line: the cluster's on-chain price when recon has
 * published it, else amount ÷ quantity (which says nothing for a line with
 * nothing used, hence "—").
 */
function rate(chainPrice: number | null, amount: number, quantity: number, unit: string, scale = 1): string {
  if (chainPrice != null) return perUnit(chainPrice, unit, scale);
  if (!quantity) return '—';
  return perUnit(amount / quantity, unit, scale);
}

/**
 * Compute is billed as one amount over three resources (CPU, RAM and GPU,
 * each with its own price on chain). Each row's share is units × price,
 * scaled so the rows add up to the amount actually billed. Without prices
 * the split is only known when a single resource was used.
 */
function computeRows(b: MonthBill, rates: Rates | null): LineRow[] {
  const compute = n(b.lines.compute_usd);
  const res = [
    { item: 'GPU', units: n(b.usage.gpu_units), unit: 'unit', label: 'units', price: rates ? n(rates.gpu_usd_per_unit) : null },
    { item: 'CPU', units: n(b.usage.cpu_units), unit: 'CPU-s', label: 'CPU-s', price: rates ? n(rates.cpu_usd_per_unit) : null },
    { item: 'RAM', units: n(b.usage.ram_units), unit: 'GB-s', label: 'GB-s', price: rates ? n(rates.ram_usd_per_unit) : null },
  ];
  const weights = res.map((r) => (r.price == null ? null : r.units * r.price));
  const sum = weights.every((w) => w != null) ? (weights as number[]).reduce((a, w) => a + w, 0) : null;
  const used = res.filter((r) => r.units > 0);
  return res.map((r, i) => {
    let amount: string;
    if (sum != null && sum > 0) amount = usd((compute * weights[i]!) / sum);
    else if (r.units === 0) amount = '$0.00';
    else if (used.length === 1) amount = usd(compute);
    else amount = '—';
    const alone = used.length === 1 && used[0] === r;
    return {
      item: r.item,
      sub: '',
      used: `${num(r.units)} ${r.label}`,
      rate: rate(r.price, alone ? compute : 0, alone ? r.units : 0, r.unit),
      amount,
    };
  });
}

function sections(b: MonthBill, rates: Rates | null): Section[] {
  const u = b.usage;
  const compute = n(b.lines.compute_usd);
  const storage = n(b.lines.storage_usd);
  const transfer = n(b.lines.transfer_usd);
  const put = n(b.lines.put_usd);
  const get = n(b.lines.get_usd);
  const gibMonths = n(u.stored_byte_months) / GIB;
  const gib = n(u.transferred_bytes) / GIB;
  const writes = n(u.put_requests);
  const reads = n(u.get_requests);
  // The chain prices storage and transfer per MiB; the bill shows GiB.
  const chain = (v: string | undefined, scale = 1) => (rates && v != null ? n(v) * scale : null);
  return [
    {
      title: 'Compute',
      amount: usd(compute),
      note: 'Includes inference: models turn tokens into GPU units, and the cluster prices GPU units.',
      rows: computeRows(b, rates),
    },
    {
      title: 'Storage',
      amount: usd(storage),
      rows: [
        {
          item: 'Held',
          sub: 'bytes held × the fraction of the month held',
          used: `${num(gibMonths)} GiB-month`,
          rate: rate(chain(rates?.storage_usd_per_mib_month, 1024), storage, gibMonths, 'GiB-month'),
          amount: usd(storage),
        },
      ],
    },
    {
      title: 'Data transfer',
      amount: usd(transfer),
      rows: [
        {
          item: 'Out',
          sub: '',
          used: `${num(gib)} GiB`,
          rate: rate(chain(rates?.transfer_usd_per_mib, 1024), transfer, gib, 'GiB'),
          amount: usd(transfer),
        },
      ],
    },
    {
      title: 'Requests',
      amount: usd(requestsUsd(b)),
      rows: [
        { item: 'Writes', sub: '', used: num(writes, 0), rate: rate(chain(rates?.put_usd_per_request), put, writes, 'M', 1e6), amount: usd(put) },
        { item: 'Reads', sub: '', used: num(reads, 0), rate: rate(chain(rates?.get_usd_per_request), get, reads, 'M', 1e6), amount: usd(get) },
      ],
    },
  ];
}

/** Billing Bills.dc.html, view = detail */
export function BillDetail() {
  const { period = '' } = useParams();
  const s = useSession();
  const navigate = useNavigate();
  const mobile = useIsMobile();
  const bills = useBills(s.account);

  const back = (
    <a
      href="/bills"
      onClick={(e) => {
        e.preventDefault();
        navigate('/billing/bills');
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        font: '500 14px/1 var(--font-sans)',
        color: 'var(--b-acc-tx)',
        textDecoration: 'none',
        minHeight: 24,
        alignSelf: 'flex-start',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
      </svg>
      All bills
    </a>
  );

  if (bills.isError) {
    return (
      <>
        {back}
        <MessageCard
          glyph="!"
          iconBg="var(--b-err-bg)"
          iconTx="var(--b-err-tx)"
          title="Could not load your bill."
          body="The billing service did not respond. Your balance and usage are not affected."
          cta="Retry"
          onCta={() => void bills.refetch()}
        />
      </>
    );
  }
  if (bills.isLoading || !bills.data) {
    return (
      <>
        {back}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skel w={260} h={24} r={6} />
          <Skel w={200} h={12} />
        </div>
        <Card style={{ gap: 14 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 16 }}>
              <Skel w="28%" h={12} />
              <div style={{ flex: 1 }} />
              <Skel w="12%" h={12} />
            </div>
          ))}
        </Card>
      </>
    );
  }

  const bill = bills.data.months.find((m) => m.month === period);
  if (!bill) {
    return (
      <>
        {back}
        <MessageCard
          glyph="·"
          iconBg="var(--b-chip)"
          iconTx="var(--b-tx2)"
          title={/^\d{4}-\d{2}$/.test(period) ? `No bill for ${monthLabel(period)}` : 'No such bill'}
          body="There is no settled usage for this account in that month."
          cta="All bills"
          onCta={() => navigate('/billing/bills')}
        />
      </>
    );
  }

  const settled = bill.status === 'settled';
  return (
    <>
      {back}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '16px 32px' }}>
        <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ font: '500 24px/1.33 var(--font-sans)', letterSpacing: '-0.12px' }}>Bill · {monthLabel(bill.month)}</div>
          <div style={{ font: '400 13px/1.4 var(--font-sans)', color: 'var(--b-tx2)' }}>
            Account <Mono style={{ color: 'var(--b-tx)' }}>{short(s.account)}</Mono>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <Mono style={{ font: '600 40px/1 var(--font-mono)', letterSpacing: '-0.02em' }}>{usd(n(bill.total_usd))}</Mono>
          <StatusPill tone={settled ? 'ok' : 'acc'} pad="4px 8px">
            {settled ? `settled · ${bill.eras} era${bill.eras === 1 ? '' : 's'}` : 'estimated, month in progress'}
          </StatusPill>
        </div>
      </div>

      <Card style={{ padding: '8px 20px 20px', gap: 28 }}>
        {sections(bill, bills.data.rates ?? null).map((sec) => (
          <div key={sec.title} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '16px 0 10px', borderBottom: '2px solid var(--b-tx)' }}>
              <span style={{ font: '700 16px/1.3 var(--font-sans)', flex: 1 }}>{sec.title}</span>
              <Mono style={{ font: '600 16px/1 var(--font-mono)' }}>{sec.amount}</Mono>
            </div>
            {mobile ? (
              sec.rows.map((r) => (
                <div key={r.item} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 0', borderTop: '1px solid var(--b-line)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ font: '500 14px/1.3 var(--font-sans)', flex: 1 }}>{r.item}</span>
                    <Mono style={{ font: '500 14px/1.3 var(--font-mono)' }}>{r.amount}</Mono>
                  </div>
                  <Mono style={{ font: '400 12px/1.4 var(--font-mono)', color: 'var(--b-tx2)' }}>
                    {r.used} at {r.rate}
                  </Mono>
                  {r.sub && <span style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--b-tx3)' }}>{r.sub}</span>}
                </div>
              ))
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.3fr 1.3fr 1fr',
                    gap: 12,
                    padding: '10px 0 6px',
                    font: '500 12px/1 var(--font-sans)',
                    color: 'var(--b-tx3)',
                  }}
                >
                  <span>Item</span>
                  <span style={{ textAlign: 'right' }}>Used</span>
                  <span style={{ textAlign: 'right' }}>Rate</span>
                  <span style={{ textAlign: 'right' }}>Amount</span>
                </div>
                {sec.rows.map((r) => (
                  <div
                    key={r.item}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1.3fr 1.3fr 1fr',
                      gap: 12,
                      alignItems: 'baseline',
                      padding: '10px 0',
                      borderTop: '1px solid var(--b-line)',
                    }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ font: '500 14px/1.3 var(--font-sans)' }}>{r.item}</span>
                      {r.sub && <span style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--b-tx3)' }}>{r.sub}</span>}
                    </span>
                    <Mono style={{ textAlign: 'right', font: '400 13px/1.3 var(--font-mono)', color: 'var(--b-tx2)' }}>{r.used}</Mono>
                    <Mono style={{ textAlign: 'right', font: '400 13px/1.3 var(--font-mono)', color: 'var(--b-tx2)' }}>{r.rate}</Mono>
                    <Mono style={{ textAlign: 'right', font: '500 14px/1.3 var(--font-mono)' }}>{r.amount}</Mono>
                  </div>
                ))}
              </>
            )}
            {sec.note && <div style={{ paddingTop: 10, font: '400 12px/1.5 var(--font-sans)', color: 'var(--b-tx2)' }}>{sec.note}</div>}
          </div>
        ))}
      </Card>

      {s.account && <AgentUsage key={bill.month} month={bill.month} account={s.account} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 4px 0' }}>
        <Overline>How this was calculated</Overline>
        <div style={{ font: '400 13px/1.6 var(--font-sans)', color: 'var(--b-tx2)', maxWidth: 720, textWrap: 'pretty' } as React.CSSProperties}>
          Usage is what DDC's inspectors verified per era, priced at the cluster's on-chain rates (set in US dollars). The chain takes the same
          amount from the account's DDC deposit, converted to CERE at the oracle rate.
        </div>
      </div>
    </>
  );
}
