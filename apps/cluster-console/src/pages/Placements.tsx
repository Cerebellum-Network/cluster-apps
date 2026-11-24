import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Button } from '@mui/material';

import type { Sandbox } from '~/api/types';
import { SelectFilter, TextFilter, useFilters } from '~/components/Filters';
import {
  color,
  Loading,
  LoadMore,
  Missing,
  Mono,
  PageHeader,
  Pill,
  RowsTable,
  Section,
  SourceLine,
  text,
} from '~/components/ui';
import { chosenNode, cpu, mib, num, time } from '~/format';
import { usePaged } from '~/hooks/usePaged';

import { verdict } from './placement';
import { PlacementTable, StatusPill, useNodeNames } from './sandboxShared';

/** The node with the most free memory after placement, as recorded; null when the record has no candidates. */
function best(s: Sandbox) {
  const c = s.placement?.candidates ?? [];
  return c.length ? [...c].sort((a, b) => b.score - a.score)[0] : null;
}

export function Placements() {
  const f = useFilters(['status', 'bucket']);
  const name = useNodeNames();
  const p = usePaged<Sandbox>('/sandboxes', { status: f.values.status, bucket: f.values.bucket, limit: 100 });

  return (
    <>
      <PageHeader
        title="Placements"
        subtitle="Why each sandbox landed on its node: the candidates the resource manager weighed, their free room and score, and each attempt."
        actions={
          <Button size="small" variant="outlined" onClick={p.refresh} disabled={p.loading}>
            Refresh
          </Button>
        }
      />
      <Section>
        <Stack spacing={0.5}>
          <Typography sx={text.label}>How the resource manager places a sandbox</Typography>
          <Typography sx={{ fontSize: 13 }}>
            In one transaction it computes each sandbox node's free room (allocatable from the node's latest report,
            minus its starting, running and unknown sandboxes), drops nodes without room, and picks the one with the
            most free memory after placement (tie: a hash of node and sandbox ID). If the node refuses or fails, it
            tries the next candidate, up to the configured attempts. The table under each row is the record RM kept of
            that decision.
          </Typography>
        </Stack>
      </Section>
      <Stack direction="row" spacing={1.5} sx={{ margin: '16px 0' }}>
        <SelectFilter
          label="Status"
          value={f.values.status}
          options={[
            ['starting', 'Starting'],
            ['running', 'Running'],
            ['terminated', 'Terminated'],
            ['failed', 'Failed'],
            ['unknown', 'Unknown'],
          ]}
          onChange={(v) => f.set('status', v)}
        />
        <TextFilter label="Customer bucket" value={f.values.bucket} onChange={(v) => f.set('bucket', v)} />
      </Stack>
      {p.error && <Missing error={p.error} />}
      {!p.loaded && !p.error && <Loading />}
      {p.loaded && (
        <Section flush>
          <RowsTable
            rows={p.items}
            rowKey={(s) => s.id}
            empty="No sandbox matches."
            columns={[
              { label: 'Sandbox', render: (s) => <Mono title={s.id}>{s.id}</Mono> },
              { label: 'Status', render: (s) => <StatusPill status={s.status} /> },
              { label: 'Asked for', render: (s) => `${cpu(s.resources.cpu)} · ${mib(s.resources.memory_mib)}` },
              { label: 'Decided', render: (s) => time(s.placement?.decided_at) },
              {
                label: 'Placed on',
                render: (s) => {
                  const n = chosenNode(s.placement, s.node);
                  return n ? name(n) : <span style={{ color: color.textTertiary }}>nowhere</span>;
                },
              },
              { label: 'Candidates', align: 'right', render: (s) => num(s.placement?.candidates?.length, 0) },
              {
                label: 'Why there',
                render: (s) => {
                  if (!s.placement) return <span style={{ color: color.textTertiary }}>no placement record</span>;
                  const cands = s.placement.candidates ?? [];
                  const fitting = cands.filter((c) => verdict(c, s.resources).fits);
                  const chosen = chosenNode(s.placement, s.node);
                  const failures = (s.placement.attempts ?? []).filter((a) => a.result !== 'accepted');
                  if (fitting.length === 0) return <Pill tone="danger">no node had room</Pill>;
                  const b = best(s);
                  return (
                    <Box>
                      {b && b.node === chosen ? (
                        <span>
                          best of {fitting.length} that fit ({cands.length} weighed): {mib(b.free_memory_mib)} free,{' '}
                          {cpu(b.free_cpu)}
                        </span>
                      ) : chosen ? (
                        <span>
                          next candidate after {failures.length} failed attempt{failures.length === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span>every attempt failed ({failures.length})</span>
                      )}
                    </Box>
                  );
                },
              },
              {
                label: 'Attempts',
                render: (s) =>
                  (s.placement?.attempts ?? []).map((a, i) => (
                    <Pill
                      key={i}
                      tone={a.result === 'accepted' ? 'success' : a.result === 'error' ? 'danger' : 'warning'}
                    >
                      {a.result}
                    </Pill>
                  )),
              },
            ]}
            detail={(s) =>
              s.placement ? (
                <Stack spacing={1}>
                  <PlacementTable
                    p={s.placement}
                    name={(id) => name(id)}
                    chosen={chosenNode(s.placement, s.node)}
                    asked={s.resources}
                  />
                  {(s.placement.attempts ?? [])
                    .filter((a) => a.detail)
                    .map((a, i) => (
                      <Typography key={i} sx={{ fontSize: 12.5 }}>
                        Attempt on {name(a.node)}: {a.result} · {a.detail}
                      </Typography>
                    ))}
                </Stack>
              ) : (
                <Typography sx={{ fontSize: 12.5 }}>
                  The resource manager returned no placement record for this sandbox.
                </Typography>
              )
            }
          />
          <LoadMore cursor={p.cursor} onMore={p.loadMore} loading={p.loading} />
        </Section>
      )}
      <SourceLine>
        Source: resource manager GET /api/v1/sandboxes, field placement (sandboxes.placement), written when RM placed
        the sandbox.
      </SourceLine>
    </>
  );
}
