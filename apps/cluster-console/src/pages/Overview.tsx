import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Button } from '@mui/material';

import type { Counts, SourceRow, Summary } from '~/api/types';
import { color, Loading, Missing, PageHeader, Pill, Section, SourceLine, Stat, text } from '~/components/ui';
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

export function Overview() {
  const nav = useNavigate();
  const v = useView<Summary>('/summary');
  const sources = useView<{ items: SourceRow[] }>('/sources', undefined, 0);
  const s = v.data;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={
          s ? `Totals as of ${time(s.generated_at)}; “last hour” counts from ${time(s.last_hour_since)}.` : undefined
        }
        actions={
          <Button size="small" variant="outlined" onClick={v.refresh} disabled={v.loading}>
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
              label="Sandbox nodes"
              value={`${num(s.nodes_healthy, 0)} of ${num(s.nodes, 0)}`}
              sub="healthy, reporting a sandbox runtime"
              source="resource manager · sandbox-nodes"
              missing={s.sections.sandbox_nodes.missing}
              onClick={() => nav('/nodes')}
            />
            <Stat
              label="Sandbox CPU"
              value={s.cpu ? `${num(s.cpu.allocated, 2)} of ${num(s.cpu.allocatable, 2)}` : '—'}
              sub={s.cpu ? `CPU allocated to live sandboxes${pct(s.cpu.allocated, s.cpu.allocatable)}` : undefined}
              source="resource manager · sandbox-nodes (allocatable from node reports, allocated = live sandboxes)"
              missing={s.sections.sandbox_nodes.missing}
              onClick={() => nav('/nodes')}
            />
            <Stat
              label="Sandbox memory"
              value={s.memory_mib ? `${mib(s.memory_mib.allocated)} of ${mib(s.memory_mib.allocatable)}` : '—'}
              sub={
                s.memory_mib
                  ? `allocated to live sandboxes${pct(s.memory_mib.allocated, s.memory_mib.allocatable)}`
                  : undefined
              }
              source="resource manager · sandbox-nodes"
              missing={s.sections.sandbox_nodes.missing}
              onClick={() => nav('/nodes')}
            />
            <Stat
              label="Sandboxes running"
              value={`${num(s.sandboxes_running, 0)}${s.sections.sandboxes.truncated ? '+' : ''}`}
              sub="all customer buckets"
              source="resource manager · sandboxes?status=running"
              missing={s.sections.sandboxes.missing}
              onClick={() => nav('/sandboxes?status=running')}
            />
            <Stat
              label="Egress, last hour"
              value={`${num(s.egress_last_hour?.allowed, 0)} allowed`}
              sub={
                s.egress_last_hour
                  ? `${num(s.egress_last_hour.denied, 0)} denied · ${num(s.egress_last_hour.error, 0)} error${s.sections.egress.truncated ? ' (at least)' : ''}`
                  : undefined
              }
              source="egress proxy · log"
              missing={s.sections.egress.missing}
              onClick={() => nav('/egress')}
            />
            <Stat
              label="Usage records, last hour"
              value={`${num(s.records_last_hour?.pushed, 0)} reached DAC`}
              sub={
                s.records_last_hour
                  ? `${num(s.records_last_hour.pending, 0)} pending · ${num(s.records_last_hour.failed, 0)} failed`
                  : undefined
              }
              source="resource manager · usage-records (DAC status from the node)"
              missing={s.sections.records.missing}
              onClick={() => nav('/usage')}
            />
            <Stat
              label="Compute nodes reporting"
              value={num(s.compute_nodes, 0)}
              sub={list(s.compute_nodes_by_module, ['sandbox', 'inference', 'agent'])}
              source="resource manager · nodes (last 30 s of reports)"
              missing={s.sections.registry.missing}
              onClick={() => nav('/nodes')}
            />
            <Stat
              label="Nodes on the blockchain"
              value={num(s.chain_nodes, 0)}
              sub={list(s.chain_nodes_by_mode, ['storage', 'full', 'cache', 'compute'])}
              source="blockchain · cluster nodes"
              missing={s.sections.chain.missing}
              onClick={() => nav('/nodes')}
            />
          </Box>

          <Box
            sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 2, alignItems: 'start' }}
          >
            <Section
              title="Needs your attention"
              subtitle="Worked out from the counts above; a missing source is not guessed at."
            >
              <Attention s={s} onOpen={(to) => nav(to)} />
            </Section>
            <Section
              title="Not available yet"
              subtitle="On the canvas, with no source this console backend can read today."
            >
              <Stack spacing={1}>
                {(sources.data?.items ?? [])
                  .filter(
                    (r) => r.kind === 'missing' && ['Storage', 'Delivery', 'Revenue', 'Customers'].includes(r.screen),
                  )
                  .map((r) => (
                    <Box key={r.screen + r.field}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{r.screen}</Typography>
                        <Pill tone="warning">source missing</Pill>
                      </Stack>
                      <Typography sx={{ ...text.caption }}>
                        {r.field}: {r.note}
                      </Typography>
                    </Box>
                  ))}
                {sources.error && <Missing error={sources.error} compact />}
              </Stack>
            </Section>
          </Box>
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
