import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Button } from '@mui/material';

import type { DACView, InferenceView } from '~/api/types';
import {
  asMissing,
  color,
  Loading,
  Missing,
  Mono,
  PageHeader,
  Pill,
  RowsTable,
  Section,
  SourceLine,
  Stat,
} from '~/components/ui';
import { num, shortKey } from '~/format';
import { useView } from '~/hooks/useView';

export function Inference() {
  const nav = useNavigate();
  const v = useView<InferenceView>('/inference');
  const dac = useView<DACView>('/dac', { hours: 24 }, 60_000);
  const models = v.data?.models ?? [];
  const serving = models.filter((m) => m.ceiling > 0);
  const capacity = serving.reduce((a, m) => a + m.ceiling, 0);
  const inFlight = serving.reduce((a, m) => a + m.in_flight, 0);
  const recorded = dac.data?.eras.filter((e) => e.consumed).length ?? 0;
  return (
    <>
      <PageHeader
        title="Inference"
        subtitle="Each model the inference nodes report, with requests at once it can take (the sum of the ready nodes' limits) and what is in flight now."
        actions={
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              v.refresh();
              dac.refresh();
            }}
            disabled={v.loading}
          >
            Refresh
          </Button>
        }
      />
      {v.error && !v.data && <Missing error={v.error} />}
      {!v.data && !v.error && <Loading />}
      {v.data && (
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2 }}>
            <Stat
              label="Requests at once, now"
              value={`${num(inFlight, 0)} of ${num(capacity, 0)}`}
              sub="in flight of capacity, all models together (not capacity any one model can use)"
              source="resource manager · nodes (inference modules' last reports)"
            />
            <Stat
              label="GPU units served"
              value=""
              source="inference gateway metrics"
              missing={{
                source: 'inference gateway metrics',
                detail:
                  'served GPU units, peaks and refusals are gateway metrics; this console backend holds no metrics read token',
              }}
            />
            <Stat
              label="GPU units verified, last 24 h"
              value={dac.data ? `${num(dac.data.consumed.gpu_units, 0)} units` : '…'}
              sub={
                dac.data ? `${recorded} of ${dac.data.eras.length} eras recorded · charged in Revenue, GPU` : undefined
              }
              source="DAC grouping collector · customers' consumed GPU units per era"
              missing={dac.error ? asMissing(dac.error) : null}
              onClick={() => nav('/revenue')}
            />
          </Box>
          {v.data.missing.map((m) => (
            <Missing key={m.source} error={m} />
          ))}
          <Section
            flush
            title={`${serving.length} models serving · ${models.length - serving.length} listed with no capacity`}
          >
            <RowsTable
              rows={[...serving, ...models.filter((m) => m.ceiling === 0)]}
              rowKey={(m) => `${m.bucket}/${m.model}/${m.version}`}
              columns={[
                {
                  label: 'Model',
                  render: (m) => (
                    <Stack>
                      <span style={{ fontWeight: 600 }}>{m.model}</span>
                      <Typography sx={{ fontSize: 11.5, color: color.textSecondary }}>
                        {m.version} · bucket {m.bucket}
                      </Typography>
                    </Stack>
                  ),
                },
                {
                  label: 'Nodes',
                  align: 'right',
                  render: (m) => `${m.nodes.filter((n) => n.status === 'ready').length} ready of ${m.nodes.length}`,
                },
                { label: 'Requests at once', align: 'right', render: (m) => num(m.ceiling, 0) },
                { label: 'In flight now', align: 'right', render: (m) => num(m.in_flight, 0) },
                { label: 'Queued now', align: 'right', render: (m) => num(m.queue, 0) },
                {
                  label: 'Load',
                  render: (m) =>
                    m.ceiling > 0 ? (
                      <Pill
                        tone={
                          m.in_flight >= m.ceiling ? 'danger' : m.in_flight / m.ceiling >= 0.8 ? 'warning' : 'success'
                        }
                      >
                        {Math.round((100 * m.in_flight) / m.ceiling)}%
                      </Pill>
                    ) : (
                      <Pill>no capacity</Pill>
                    ),
                },
              ]}
              detail={(m) => (
                <Stack spacing={0.5}>
                  {m.nodes.map((n) => (
                    <Typography key={n.node} sx={{ fontSize: 12.5 }}>
                      {n.node === n.host ? n.host : <Mono title={n.node}>{shortKey(n.node, 10, 4)}</Mono>}
                      {n.node === n.host ? '' : ` · ${n.host}`} · {n.status} · {n.healthy ? 'healthy' : 'not healthy'} ·
                      limit {num(n.ceiling, 0)} · in flight {num(n.in_flight, 0)} · queue {num(n.queue, 0)}
                    </Typography>
                  ))}
                </Stack>
              )}
            />
          </Section>
          <SourceLine>
            Source: the inference nodes' last reports in the resource manager (GET /api/v1/nodes). A snapshot: there is
            no history here. Not shown, no source yet: peak requests at once, refusals (model full or customer at their
            limit) and their history — gateway metrics this console backend has no read token for.
          </SourceLine>
        </Stack>
      )}
    </>
  );
}
