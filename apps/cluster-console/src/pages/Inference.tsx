import { Stack, Typography } from '@cluster-apps/ui';
import { Button } from '@mui/material';

import type { InferenceView } from '~/api/types';
import { color, Loading, Missing, Mono, PageHeader, Pill, RowsTable, Section, SourceLine } from '~/components/ui';
import { num, shortKey } from '~/format';
import { useView } from '~/hooks/useView';

export function Inference() {
  const v = useView<InferenceView>('/inference');
  const models = v.data?.models ?? [];
  const serving = models.filter((m) => m.ceiling > 0);
  return (
    <>
      <PageHeader
        title="Inference"
        subtitle="Each model the inference nodes report, with requests at once it can take (the sum of the ready nodes' limits) and what is in flight now."
        actions={
          <Button size="small" variant="outlined" onClick={v.refresh} disabled={v.loading}>
            Refresh
          </Button>
        }
      />
      {v.error && !v.data && <Missing error={v.error} />}
      {!v.data && !v.error && <Loading />}
      {v.data && (
        <Stack spacing={2}>
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
                      <Mono title={n.node}>{shortKey(n.node, 10, 4)}</Mono> · {n.host} · {n.status} ·{' '}
                      {n.healthy ? 'healthy' : 'not healthy'} · limit {num(n.ceiling, 0)} · in flight{' '}
                      {num(n.in_flight, 0)} · queue {num(n.queue, 0)}
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
