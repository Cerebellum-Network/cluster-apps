import { useMemo, useState } from 'react';
import type { LedgerEntry } from '../api';
import { config } from '../billingConfig';
import { num, shortDate, signedUsd, usdBalance } from '../../lib/format';
import { useIsMobile } from '../../lib/useIsMobile';
import { Overline, Skel } from '../../components/ui';

const PAGE = 8;

const TYPES: Record<string, string> = {
  manual_topup: 'Top-up',
  auto_recharge: 'Auto top-up',
  shortfall_cover: 'Usage charge',
  shortfall_recharge: 'Balance restore',
};
const FILTERS = ['All', 'Top-up', 'Auto top-up', 'Usage charge', 'Balance restore'] as const;
type Filter = (typeof FILTERS)[number];

function typeLabel(t: string): string {
  return TYPES[t] ?? t.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/**
 * Billing Payments.dc.html, Payment history. The ledger endpoint has no type
 * filter, so the list is loaded once and filtered and paged here. The
 * on-chain status column needs per-entry funding state that payment-service
 * does not serve yet; it stays hidden behind its feature flag.
 */
export function History({ ledger, loading }: { ledger: LedgerEntry[] | undefined; loading: boolean }) {
  const mobile = useIsMobile();
  const [filter, setFilter] = useState<Filter>('All');
  const [page, setPage] = useState(0);
  const chain = config.features.chainStatus;
  const cols = chain ? '1fr 1.6fr 1fr 1fr 1.4fr' : '1fr 1.6fr 1fr 1fr';

  const rows = useMemo(
    () => (ledger ?? []).filter((e) => filter === 'All' || typeLabel(e.entry_type) === filter),
    [ledger, filter],
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE);

  const view = shown.map((e) => {
    const amount = Number(e.amount_usd);
    const era = e.era_id && /^\d+$/.test(e.era_id) ? `· era ${num(Number(e.era_id), 0)}` : e.era_id ? `· era ${e.era_id}` : '';
    return {
      id: e.id,
      date: shortDate(e.created_at),
      type: typeLabel(e.entry_type),
      era,
      amount: signedUsd(amount),
      amtColor: amount > 0 ? 'var(--b-ok-tx)' : 'var(--b-tx)',
      after: usdBalance(e.running_balance_usd),
    };
  });

  return (
    <div style={{ borderRadius: 16, border: '1px solid var(--b-line)', background: 'var(--b-card)', overflow: 'visible' }}>
      <div style={{ padding: '20px 20px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Overline>Payment history</Overline>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Filter by type">
          {FILTERS.map((f) => {
            const on = f === filter;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setFilter(f);
                  setPage(0);
                }}
                style={{
                  font: '500 13px/1 var(--font-sans)',
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: `1px solid ${on ? 'var(--b-acc)' : 'var(--b-line)'}`,
                  background: on ? 'var(--b-acc-soft)' : 'transparent',
                  color: on ? 'var(--b-acc-tx)' : 'var(--b-tx2)',
                  cursor: 'pointer',
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {!mobile && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: cols,
            gap: 12,
            padding: '10px 20px',
            borderTop: '1px solid var(--b-line)',
            borderBottom: '1px solid var(--b-line)',
            font: '500 12px/1 var(--font-sans)',
            color: 'var(--b-tx3)',
          }}
        >
          <span>Date</span>
          <span>Type</span>
          <span style={{ textAlign: 'right' }}>Amount</span>
          <span style={{ textAlign: 'right' }}>Balance after</span>
          {chain && <span>On-chain status</span>}
        </div>
      )}

      {loading &&
        [1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--b-line)' }}>
            <Skel w="14%" h={12} />
            <Skel w="24%" h={12} />
            <div style={{ flex: 1 }} />
            <Skel w="12%" h={12} />
          </div>
        ))}

      {!loading && view.length === 0 && (
        <div
          style={{
            padding: '24px 20px',
            font: '400 14px/1.5 var(--font-sans)',
            color: 'var(--b-tx2)',
            textAlign: 'center',
            borderTop: mobile ? '1px solid var(--b-line)' : undefined,
          }}
        >
          {filter === 'All' ? 'No payments yet.' : `No ${filter.toLowerCase()} entries yet.`}
        </div>
      )}

      {!mobile &&
        view.map((h) => (
          <div
            key={h.id}
            style={{
              display: 'grid',
              gridTemplateColumns: cols,
              gap: 12,
              alignItems: 'center',
              padding: '12px 20px',
              borderBottom: '1px solid var(--b-line)',
            }}
          >
            <span style={{ font: '400 13px/1 var(--font-mono)', color: 'var(--b-tx2)' }}>{h.date}</span>
            <span style={{ font: '500 14px/1.3 var(--font-sans)' }}>
              {h.type} <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--b-tx3)' }}>{h.era}</span>
            </span>
            <span style={{ textAlign: 'right', font: '500 14px/1 var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: h.amtColor }}>
              {h.amount}
            </span>
            <span style={{ textAlign: 'right', font: '400 13px/1 var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--b-tx2)' }}>
              {h.after}
            </span>
            {chain && <span style={{ color: 'var(--b-tx3)' }}>—</span>}
          </div>
        ))}

      {mobile &&
        view.map((h) => (
          <div key={h.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 16px', borderTop: '1px solid var(--b-line)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ font: '500 14px/1.3 var(--font-sans)', flex: 1 }}>{h.type}</span>
              <span style={{ font: '500 14px/1 var(--font-mono)', color: h.amtColor }}>{h.amount}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', font: '400 12px/1 var(--font-mono)', color: 'var(--b-tx3)' }}>
              <span style={{ flex: 1 }}>
                {h.date} {h.era}
              </span>
              <span>{h.after}</span>
            </div>
          </div>
        ))}

      {rows.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderTop: mobile ? '1px solid var(--b-line)' : undefined }}>
          <span style={{ flex: 1, font: '400 12px/1 var(--font-sans)', color: 'var(--b-tx3)' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {current * PAGE + 1}–{current * PAGE + shown.length}
            </span>{' '}
            of <span style={{ fontFamily: 'var(--font-mono)' }}>{rows.length}</span>
          </span>
          <Pager page={current} pages={pages} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  // Up to five page numbers, centred on the current page.
  const start = Math.max(0, Math.min(page - 2, pages - 5));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const box = {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    border: 0,
    background: 'transparent',
    cursor: 'pointer',
    font: '500 13px/1 var(--font-sans)',
    color: 'var(--b-tx)',
    padding: 0,
  } as const;
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button
        type="button"
        aria-label="Previous page"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        style={{ ...box, color: page === 0 ? 'var(--b-tx3)' : 'var(--b-tx)', cursor: page === 0 ? 'default' : 'pointer' }}
      >
        ‹
      </button>
      {nums.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onPage(p)}
          style={{ ...box, ...(p === page ? { background: 'var(--b-acc)', color: '#fff' } : {}) }}
        >
          {p + 1}
        </button>
      ))}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pages - 1}
        onClick={() => onPage(page + 1)}
        style={{ ...box, color: page >= pages - 1 ? 'var(--b-tx3)' : 'var(--b-tx)', cursor: page >= pages - 1 ? 'default' : 'pointer' }}
      >
        ›
      </button>
    </div>
  );
}
