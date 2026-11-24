import { Stack, Typography } from '@cluster-apps/ui';
import { Button } from '@mui/material';

import type { EgressEntry } from '~/api/types';
import { SelectFilter, TextFilter, useFilters } from '~/components/Filters';
import {
  color,
  Facts,
  Loading,
  LoadMore,
  Missing,
  Mono,
  PageHeader,
  Pill,
  RowsTable,
  Section,
  SourceLine,
} from '~/components/ui';
import { bytes, num, shortKey, time } from '~/format';
import { usePaged } from '~/hooks/usePaged';

import { useNodeNames } from './sandboxShared';

const TONE = { allowed: 'success', denied: 'warning', error: 'danger' } as const;

export function Egress() {
  const f = useFilters(['decision', 'bucket', 'sandbox_id', 'node']);
  const name = useNodeNames();
  const p = usePaged<EgressEntry>('/egress/log', {
    decision: f.values.decision,
    bucket: f.values.bucket,
    sandbox_id: f.values.sandbox_id,
    node: f.values.node,
    limit: 100,
  });

  return (
    <>
      <PageHeader
        title="Egress log"
        subtitle="Every request a sandbox made to the outside, allowed or denied, across customer buckets. The credential column is the name of the secret the proxy added; values are never logged."
        actions={
          <Button size="small" variant="outlined" onClick={p.refresh} disabled={p.loading}>
            Refresh
          </Button>
        }
      />
      <Stack direction="row" spacing={1.5} sx={{ marginBottom: 2 }} flexWrap="wrap" useFlexGap>
        <SelectFilter
          label="Decision"
          value={f.values.decision}
          options={[
            ['allowed', 'Allowed'],
            ['denied', 'Denied'],
            ['error', 'Error'],
          ]}
          onChange={(v) => f.set('decision', v)}
        />
        <TextFilter label="Customer bucket" value={f.values.bucket} onChange={(v) => f.set('bucket', v)} width={150} />
        <TextFilter label="Sandbox" value={f.values.sandbox_id} onChange={(v) => f.set('sandbox_id', v)} width={260} />
        <TextFilter label="Node ID" value={f.values.node} onChange={(v) => f.set('node', v)} width={220} />
      </Stack>
      {p.error && <Missing error={p.error} />}
      {!p.loaded && !p.error && <Loading />}
      {p.loaded && (
        <Section flush>
          <RowsTable
            rows={p.items}
            rowKey={(e) => `${e.id}`}
            empty="No egress request matches."
            columns={[
              { label: 'Time', render: (e) => <span style={{ whiteSpace: 'nowrap' }}>{time(e.ts)}</span> },
              {
                label: 'Decision',
                render: (e) => <Pill tone={TONE[e.decision as keyof typeof TONE] ?? 'neutral'}>{e.decision}</Pill>,
              },
              {
                label: 'Request',
                render: (e) => (
                  <Mono>
                    {e.method} {e.host}
                    {e.path ?? ''}
                  </Mono>
                ),
              },
              { label: 'Status', align: 'right', render: (e) => (e.status != null ? e.status : '—') },
              {
                label: 'Credential added',
                render: (e) =>
                  e.credential ? (
                    <Pill tone="primary">{e.credential}</Pill>
                  ) : (
                    <span style={{ color: color.textTertiary }}>none</span>
                  ),
              },
              { label: 'Reason', render: (e) => e.reason ?? '—' },
              { label: 'Bucket', align: 'right', render: (e) => e.bucket ?? '—' },
              {
                label: 'Sandbox',
                render: (e) => <Mono title={e.sandbox_id ?? ''}>{shortKey(e.sandbox_id, 9, 4)}</Mono>,
              },
              { label: 'Up · down', align: 'right', render: (e) => `${bytes(e.bytes_up)} · ${bytes(e.bytes_down)}` },
              {
                label: 'Took',
                align: 'right',
                render: (e) => (e.duration_ms != null ? `${num(e.duration_ms, 0)} ms` : '—'),
              },
            ]}
            detail={(e) => (
              <Facts
                items={[
                  ['Entry', `${e.id}`],
                  ['Sandbox', <Mono key="s">{e.sandbox_id ?? '—'}</Mono>],
                  ['Node', e.node ? `${name(e.node)} (${shortKey(e.node)})` : '—'],
                  ['Path', <Mono key="p">{e.path ?? 'n/a (refused at CONNECT)'}</Mono>],
                  [
                    'Credential',
                    e.credential
                      ? `secret “${e.credential}” of bucket ${e.bucket}, injected as a header by the proxy`
                      : 'none',
                  ],
                ]}
              />
            )}
          />
          <LoadMore cursor={p.cursor} onMore={p.loadMore} loading={p.loading} />
        </Section>
      )}
      <Typography component="div" sx={{ marginTop: 1 }}>
        <SourceLine>
          Source: egress proxy GET /admin/v1/log (table egress_requests), read with its read-only key. Query strings and
          header values are never stored.
        </SourceLine>
      </Typography>
    </>
  );
}
