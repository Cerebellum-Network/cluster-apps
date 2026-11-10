import { useState } from 'react';
import { ApiError, orchestrator, recon, type AgentUsage as Usage } from '../api';
import { compact, num, short } from '../../lib/format';
import { useIsMobile } from '../../lib/useIsMobile';
import { useSession } from '../../wallet/session';
import { Btn, Card, Mono, Overline, Skel, TagPill } from '../../components/ui';

type Row = { agent: string; usage?: Usage; denied?: boolean; unavailable?: boolean };
type View =
  | { kind: 'collapsed'; error?: string }
  | { kind: 'loading' }
  | { kind: 'none'; total: number }
  | { kind: 'expanded'; rows: Row[] };

const AGENT_COLS = '2fr 1fr 1.2fr 1.2fr 1.2fr';
const MODEL_COLS = '2fr 1fr 1fr 1fr';

/**
 * Usage by agent for one bill month, as the orchestrator measured it. Loaded
 * on a click with a read-only wallet delegation: on an http origin the wallet
 * may open a window, which needs a user gesture.
 */
export function AgentUsage({ month, account }: { month: string; account: string }) {
  const s = useSession();
  const mobile = useIsMobile();
  const [view, setView] = useState<View>({ kind: 'collapsed' });

  const load = async () => {
    setView({ kind: 'loading' });
    try {
      const token = await s.getToken();
      const agents = await recon.agents(account);
      const { from, to } = monthWindow(month);
      const rows = await mapLimit(agents, 4, async (agent): Promise<Row> => {
        try {
          return { agent, usage: await orchestrator.usage(agent, from, to, token) };
        } catch (e) {
          return e instanceof ApiError && e.status === 403 ? { agent, denied: true } : { agent, unavailable: true };
        }
      });
      const shown = rows
        .filter((r) => !r.usage || r.usage.total.executions > 0)
        .sort(
          (a, b) =>
            (b.usage?.total.metrics.gpuUnits ?? -1) - (a.usage?.total.metrics.gpuUnits ?? -1) ||
            (b.usage?.total.executions ?? -1) - (a.usage?.total.executions ?? -1),
        );
      setView(shown.length ? { kind: 'expanded', rows: shown } : { kind: 'none', total: agents.length });
    } catch (e) {
      setView({ kind: 'collapsed', error: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <Card style={{ gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ font: '700 16px/1.3 var(--font-sans)' }}>Usage by agent</span>
        <TagPill>measured</TagPill>
      </div>

      {view.kind === 'collapsed' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Btn
            variant="secondary"
            onClick={load}
            style={{ font: '500 14px/1 var(--font-sans)', letterSpacing: '.5px', padding: '12px 18px', minHeight: 44 }}
          >
            Show usage by agent
          </Btn>
          <span style={{ font: '400 12px/1.4 var(--font-sans)', color: view.error ? 'var(--b-err-tx)' : 'var(--b-tx3)' }}>
            {view.error ? `The wallet didn't grant a token: ${view.error}` : 'Asks your wallet for a read-only token.'}
          </span>
        </div>
      )}

      {view.kind === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ font: '400 13px/1.4 var(--font-sans)', color: 'var(--b-tx2)' }}>
            Waiting for the wallet to grant a read-only token…
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 16 }}>
              <Skel w="28%" h={12} />
              <div style={{ flex: 1 }} />
              <Skel w="12%" h={12} />
              <Skel w="12%" h={12} />
            </div>
          ))}
        </div>
      )}

      {view.kind === 'none' && (
        <div
          style={{
            padding: 24,
            borderRadius: 12,
            background: 'var(--b-chip)',
            font: '400 14px/1.5 var(--font-sans)',
            color: 'var(--b-tx2)',
            textAlign: 'center',
          }}
        >
          {view.total === 0
            ? 'No agents are registered to this account.'
            : `None of your ${view.total} agent${view.total === 1 ? '' : 's'} ran this month.`}
        </div>
      )}

      {view.kind === 'expanded' && (
        <>
          {mobile ? <AgentRowsMobile rows={view.rows} /> : <AgentTable rows={view.rows} />}
          <ModelTable rows={view.rows} />
          <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--b-tx2)', textWrap: 'pretty' } as React.CSSProperties}>
            These figures are measured, not charged. The Compute line above is what's charged.
          </div>
        </>
      )}
    </Card>
  );
}

const NO_ACCESS = "No access · this agent's owner hasn't shared usage with your wallet";
const UNAVAILABLE = "Unavailable · the orchestrator didn't return this agent's usage";

function failed(u: Usage) {
  const f = u.total.failed;
  return { text: `${num(f, 0)} failed`, color: f > 0 ? 'var(--b-err-tx)' : 'var(--b-tx3)' };
}

function AgentTable({ rows }: { rows: Row[] }) {
  const right = { textAlign: 'right', font: '400 13px/1.3 var(--font-mono)', color: 'var(--b-tx2)' } as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: AGENT_COLS,
          gap: 12,
          padding: '0 0 8px',
          font: '500 12px/1 var(--font-sans)',
          color: 'var(--b-tx3)',
          borderBottom: '1px solid var(--b-line)',
        }}
      >
        <span>Agent</span>
        <span style={{ textAlign: 'right' }}>Runs</span>
        <span style={{ textAlign: 'right' }}>CPU-seconds</span>
        <span style={{ textAlign: 'right' }}>RAM GB-seconds</span>
        <span style={{ textAlign: 'right' }}>GPU units</span>
      </div>
      {rows.map((r) => {
        const u = r.usage;
        return (
          <div
            key={r.agent}
            style={{
              display: 'grid',
              gridTemplateColumns: AGENT_COLS,
              gap: 12,
              alignItems: 'baseline',
              padding: '10px 0',
              borderBottom: '1px solid var(--b-line)',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <Mono style={{ font: '500 14px/1.3 var(--font-mono)', overflowWrap: 'anywhere' }}>{alias(r.agent)}</Mono>
              <Mono style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--b-tx3)' }}>{serviceId(r.agent)}</Mono>
            </span>
            {u ? (
              <>
                <span style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Mono style={{ font: '400 13px/1.3 var(--font-mono)' }}>{num(u.total.executions, 0)}</Mono>
                  <span style={{ font: '400 12px/1 var(--font-sans)', color: failed(u).color }}>{failed(u).text}</span>
                </span>
                <Mono style={right}>{num(u.total.metrics.cpuUnits)}</Mono>
                <Mono style={right}>{num(u.total.metrics.memoryUnits)}</Mono>
                <Mono style={right}>{num(u.total.metrics.gpuUnits)}</Mono>
              </>
            ) : (
              <span style={{ gridColumn: '2 / span 4', textAlign: 'right', font: '400 13px/1.3 var(--font-sans)', color: 'var(--b-tx3)' }}>
                {r.denied ? NO_ACCESS : UNAVAILABLE}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AgentRowsMobile({ rows }: { rows: Row[] }) {
  const v = { fontFamily: 'var(--font-mono)', color: 'var(--b-tx)' };
  return (
    <div>
      {rows.map((r) => {
        const u = r.usage;
        return (
          <div key={r.agent} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 0', borderTop: '1px solid var(--b-line)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <Mono style={{ font: '500 14px/1.3 var(--font-mono)', flex: 1, overflowWrap: 'anywhere' }}>{alias(r.agent)}</Mono>
              <Mono style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--b-tx3)' }}>{serviceId(r.agent)}</Mono>
            </div>
            {u ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px 12px',
                  font: '400 12px/1.4 var(--font-sans)',
                  color: 'var(--b-tx3)',
                }}
              >
                <span>
                  Runs <span style={v}>{num(u.total.executions, 0)}</span> <span style={{ color: failed(u).color }}>{failed(u).text}</span>
                </span>
                <span>
                  GPU <span style={v}>{num(u.total.metrics.gpuUnits)}</span>
                </span>
                <span>
                  CPU-s <span style={v}>{num(u.total.metrics.cpuUnits)}</span>
                </span>
                <span>
                  RAM GB-s <span style={v}>{num(u.total.metrics.memoryUnits)}</span>
                </span>
              </div>
            ) : (
              <span style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--b-tx3)' }}>{r.denied ? 'No access' : 'Unavailable'}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ModelTable({ rows }: { rows: Row[] }) {
  const models = mergeModels(rows);
  if (models.length === 0) return null;
  const tok = (v: number, unit: string) => (v ? `${compact(v)} ${unit === 'tokens' || unit === 'token' ? 'tok' : unit}` : '—');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
      <Overline>Inference by model</Overline>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: MODEL_COLS,
          gap: 12,
          padding: '6px 0',
          font: '500 12px/1 var(--font-sans)',
          color: 'var(--b-tx3)',
          borderBottom: '1px solid var(--b-line)',
        }}
      >
        <span>Model</span>
        <span style={{ textAlign: 'right' }}>Input</span>
        <span style={{ textAlign: 'right' }}>Output</span>
        <span style={{ textAlign: 'right' }}>GPU units</span>
      </div>
      {models.map((m) => (
        <div
          key={m.model}
          style={{
            display: 'grid',
            gridTemplateColumns: MODEL_COLS,
            gap: 12,
            padding: '8px 0',
            borderBottom: '1px solid var(--b-line)',
            font: '400 13px/1.3 var(--font-mono)',
            color: 'var(--b-tx2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ color: 'var(--b-tx)', overflowWrap: 'anywhere' }}>{m.model}</span>
          <span style={{ textAlign: 'right' }}>{tok(m.input, m.unit)}</span>
          <span style={{ textAlign: 'right' }}>{tok(m.output, m.unit)}</span>
          <span style={{ textAlign: 'right' }}>{num(m.gpuUnits)}</span>
        </div>
      ))}
    </div>
  );
}

/** Agent ids are `<service public key>:<alias>`. */
function alias(agentId: string): string {
  return agentId.split(':')[1] ?? agentId;
}

function serviceId(agentId: string): string {
  return short(agentId.split(':')[0].replace(/^0x/, ''));
}

function monthWindow(yyyymm: string): { from: Date; to: Date } {
  const [y, m] = yyyymm.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const now = new Date();
  return { from, to: end < now ? end : now };
}

function mergeModels(rows: Row[]) {
  const byModel = new Map<string, { model: string; unit: string; input: number; output: number; gpuUnits: number }>();
  for (const r of rows) {
    for (const m of r.usage?.modelBreakdown ?? []) {
      const cur = byModel.get(m.model) ?? { model: m.model, unit: m.unit, input: 0, output: 0, gpuUnits: 0 };
      cur.input += m.input;
      cur.output += m.output;
      cur.gpuUnits += m.gpuUnits;
      byModel.set(m.model, cur);
    }
  }
  return [...byModel.values()].sort((a, b) => b.gpuUnits - a.gpuUnits);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}
