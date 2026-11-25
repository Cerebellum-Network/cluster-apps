import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Button } from '@mui/material';

import type { Counts, DACView, InferenceView, SourceError, SourceRow, Summary } from '~/api/types';
import { asMissing, color, Loading, Missing, PageHeader, Pill, Section, SourceLine, Stat, text } from '~/components/ui';
import { mib, num, time } from '~/format';
import { useView } from '~/hooks/useView';

import { attention } from './attention';

const list = (c: Counts | null, order?: string[]) => {
  if (!c) return '';
  const keys = order ?? Object.keys(c).sort();
  return keys
    .filter((k) => c[k] !== undefined)
    .map((k) => `${num(c[k], 0)} ${k}`)
    .join(' · ');
};

const pct = (a: number, b: number) => (b > 0 ? ` (${Math.round((100 * a) / b)}%)` : '');

/** A screen with no source here: the card says so and why, from the sources list. */
function sourceNote(rows: SourceRow[] | undefined, screen: string): SourceError {
  const r = rows?.find((x) => x.screen === screen && x.kind === 'missing');
  return { source: screen, detail: r ? `${r.field}: ${r.note}` : 'no source this console backend reads' };
}

/** The canvas's Main board: one card per area, each opening its page; what needs the manager. */
export function Overview() {
  const nav = useNavigate();
  const v = useView<Summary>('/summary');
  const inf = useView<InferenceView>('/inference');
  const dac = useView<DACView>('/dac', { hours: 24 }, 60_000);
  const sources = useView<{ items: SourceRow[] }>('/sources', undefined, 0);
  const s = v.data;
  const rows = sources.data?.items;
  const models = inf.data?.models ?? [];
  const serving = models.filter((m) => m.ceiling > 0);
  const capacity = serving.reduce((a, m) => a + m.ceiling, 0);
  const inFlight = serving.reduce((a, m) => a + m.in_flight, 0);
  const eras = dac.data?.eras ?? [];
  const paid = eras.filter((e) => e.status === 'ERA_PAID').length;
  const refresh = () => [v, inf, dac].forEach((x) => x.refresh());

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={
          s ? `Totals as of ${time(s.generated_at)}; “last hour” counts from ${time(s.last_hour_since)}.` : undefined
        }
        actions={
          <Button size="small" variant="outlined" onClick={refresh} disabled={v.loading || inf.loading || dac.loading}>
            Refresh
          </Button>
        }
      />
      {v.error && !s && <Missing error={v.error} />}
      {!s && !v.error && <Loading />}
      {s && (
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 2 }}>
            <Stat
              label="Nodes"
              value={`${num(s.chain_nodes, 0)} in the cluster`}
              sub={
                <>
                  {list(s.chain_nodes_by_mode, ['storage', 'full', 'cache', 'compute'])}
                  {s.compute_nodes !== null && (
                    <>
                      <br />
                      {num(s.compute_nodes, 0)} compute nodes reporting:{' '}
                      {list(s.compute_nodes_by_module, ['sandbox', 'inference', 'agent'])}
                    </>
                  )}
                </>
              }
              source="blockchain · cluster nodes; resource manager · nodes (last 30 s of reports)"
              missing={s.sections.chain.missing}
              onClick={() => nav('/nodes')}
            />
            <Stat
              label="Storage"
              value=""
              source="Storage"
              missing={sourceNote(rows, 'Storage')}
              onClick={() => nav('/missing/storage')}
            />
            <Stat
              label="Delivery"
              value=""
              source="Delivery"
              missing={sourceNote(rows, 'Delivery')}
              onClick={() => nav('/missing/delivery')}
            />
            <Stat
              label="Inference"
              value={inf.data ? `${num(inFlight, 0)} of ${num(capacity, 0)}` : '…'}
              sub={
                inf.data
                  ? `requests at once now, all models together · ${serving.length} models serving, ${models.length - serving.length} with no capacity`
                  : undefined
              }
              source="resource manager · nodes (inference modules' last reports)"
              missing={inf.error ? asMissing(inf.error) : (inf.data?.missing[0] ?? null)}
              onClick={() => nav('/inference')}
            />
            <Stat
              label="Sandboxes"
              value={`${num(s.sandboxes_running, 0)}${s.sections.sandboxes.truncated ? '+' : ''} running`}
              sub={
                s.cpu && s.memory_mib
                  ? `${num(s.cpu.allocated, 2)} of ${num(s.cpu.allocatable, 2)} CPU${pct(s.cpu.allocated, s.cpu.allocatable)} · ${mib(s.memory_mib.allocated)} of ${mib(s.memory_mib.allocatable)} allocated · ${num(s.nodes_healthy, 0)} of ${num(s.nodes, 0)} nodes healthy`
                  : undefined
              }
              source="resource manager · sandboxes?status=running, sandbox-nodes"
              missing={s.sections.sandboxes.missing ?? s.sections.sandbox_nodes.missing}
              onClick={() => nav('/sandboxes')}
            />
            <Stat
              label="Revenue"
              value={dac.data ? `${num(paid, 0)} of ${num(eras.length, 0)} eras paid` : '…'}
              sub={
                dac.data
                  ? 'last 24 h, from DAC · collected in USD and CERE: no source (payout receipts not read)'
                  : undefined
              }
              source="DAC grouping collector · eras"
              missing={dac.error ? asMissing(dac.error) : null}
              onClick={() => nav('/revenue')}
            />
            <Stat
              label="Customers"
              value=""
              source="Customers"
              missing={sourceNote(rows, 'Customers')}
              onClick={() => nav('/missing/customers')}
            />
          </Box>

          <Section
            title="Needs your attention"
            subtitle="Worked out from the counts above; a missing source is not guessed at."
          >
            <Attention s={s} onOpen={(to) => nav(to)} />
          </Section>
          <SourceLine>
            Every number on this page and where it comes from: “What backs each number” in the sidebar.
          </SourceLine>
        </Stack>
      )}
    </>
  );
}

function Attention({ s, onOpen }: { s: Summary; onOpen: (to: string) => void }) {
  const items = attention(s);
  if (items.length === 0) {
    return <Typography sx={text.secondary}>Nothing in the counts above needs you now.</Typography>;
  }
  return (
    <Stack divider={<Box sx={{ borderTop: `1px solid ${color.border}` }} />}>
      {items.map((a) => (
        <Stack key={a.title} direction="row" spacing={1.5} alignItems="center" sx={{ padding: '8px 0' }}>
          <Box sx={{ width: 76, flexShrink: 0 }}>
            <Pill tone={a.tone === 'bad' ? 'danger' : 'warning'}>{a.tag}</Pill>
          </Box>
          <Box flex={1} minWidth={0}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{a.title}</Typography>
            <Typography sx={text.caption}>{a.detail}</Typography>
          </Box>
          <Button size="small" onClick={() => onOpen(a.to)}>
            Open
          </Button>
        </Stack>
      ))}
    </Stack>
  );
}
