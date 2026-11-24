import { Stack, Typography } from '@cluster-apps/ui';
import { Button } from '@mui/material';

import type { UsageRecord } from '~/api/types';
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
import { bytes, mib, num, shortKey, time } from '~/format';
import { usePaged } from '~/hooks/usePaged';

import { useNodeNames } from './sandboxShared';

const TONE = { pushed: 'success', pending: 'primary', failed: 'danger' } as const;

const period = (r: UsageRecord) => {
  const a = new Date(r.period_start);
  const b = new Date(r.period_end);
  const hm = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${time(r.period_start).replace(/, \d\d:\d\d:\d\d$/, '')} ${hm(a)}–${hm(b)}`;
};

export function Usage() {
  const f = useFilters(['dac_status', 'bucket', 'sandbox_id', 'node']);
  const name = useNodeNames();
  const p = usePaged<UsageRecord>('/usage/records', {
    dac_status: f.values.dac_status,
    bucket: f.values.bucket,
    sandbox_id: f.values.sandbox_id,
    node: f.values.node,
    limit: 100,
  });

  return (
    <>
      <PageHeader
        title="Usage records"
        subtitle="One record per sandbox per minute plus a final one, as the sandbox runtime measured it, and whether each reached the host's DAC agent."
        actions={
          <Button size="small" variant="outlined" onClick={p.refresh} disabled={p.loading}>
            Refresh
          </Button>
        }
      />
      <Stack direction="row" spacing={1.5} sx={{ marginBottom: 2 }} flexWrap="wrap" useFlexGap>
        <SelectFilter
          label="DAC status"
          value={f.values.dac_status}
          options={[
            ['pushed', 'Reached DAC agent'],
            ['pending', 'Pending'],
            ['failed', 'Failed'],
          ]}
          onChange={(v) => f.set('dac_status', v)}
          width={190}
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
            rowKey={(r) => r.record_id}
            empty="No usage record matches."
            columns={[
              { label: 'Period', render: (r) => <span style={{ whiteSpace: 'nowrap' }}>{period(r)}</span> },
              { label: 'Sandbox', render: (r) => <Mono title={r.sandbox_id}>{shortKey(r.sandbox_id, 9, 4)}</Mono> },
              { label: 'Bucket', align: 'right', render: (r) => r.bucket },
              { label: 'Node', render: (r) => name(r.node) },
              { label: 'CPU-s', align: 'right', render: (r) => num(r.cpu_s, 2) },
              { label: 'GiB-s', align: 'right', render: (r) => num(r.ram_gib_s, 2) },
              { label: 'TCA', align: 'right', render: (r) => <Mono>{r.tca_id}</Mono> },
              {
                label: 'Kind',
                render: (r) =>
                  r.final ? (
                    <Pill tone="neutral" title={r.exit_reason ?? ''}>
                      final · {r.exit_reason ?? 'exit'}
                    </Pill>
                  ) : (
                    'minute'
                  ),
              },
              {
                label: 'Reached DAC agent',
                render: (r) => (
                  <Stack spacing={0.25}>
                    <Pill tone={TONE[r.dac_status as keyof typeof TONE] ?? 'neutral'}>
                      {r.dac_status === 'pushed' ? 'yes · pushed' : r.dac_status}
                    </Pill>
                    {r.dac_updated_at && (
                      <Typography sx={{ fontSize: 11.5, color: color.textSecondary }}>
                        {time(r.dac_updated_at)}
                      </Typography>
                    )}
                  </Stack>
                ),
              },
            ]}
            detail={(r) => (
              <Facts
                items={[
                  ['Record ID (DAC)', <Mono key="r">{r.record_id}</Mono>],
                  ['Sandbox', <Mono key="s">{r.sandbox_id}</Mono>],
                  ['Node', `${name(r.node)} (${r.node})`],
                  ['Period', `${time(r.period_start)} – ${time(r.period_end)}`],
                  ['CPU units (CPU-s × 1e11)', <Mono key="c">{r.cpu_units}</Mono>],
                  ['RAM units (GiB-s × 1e11)', <Mono key="m">{r.ram_units}</Mono>],
                  ['Memory peak', mib(r.memory_peak_mib)],
                  ['Network out · in', `${bytes(r.net_egress_bytes)} · ${bytes(r.net_ingress_bytes)}`],
                  ['Disk peak', mib(r.disk_peak_mib)],
                  [
                    'DAC agent',
                    r.dac_status === 'pushed'
                      ? `accepted ${time(r.dac_updated_at)}`
                      : `${r.dac_status}${r.dac_error ? ` · ${r.dac_error}` : ''}`,
                  ],
                ]}
              />
            )}
          />
          <LoadMore cursor={p.cursor} onMore={p.loadMore} loading={p.loading} />
        </Section>
      )}
      <SourceLine>
        Source: resource manager GET /api/v1/usage-records (table sandbox_usage_records): the summary of each signed DAC
        record the node wrote, and its push status to the node's DAC agent. Whether DAC collectors aggregate these
        records is not known to this console (no source).
      </SourceLine>
    </>
  );
}
