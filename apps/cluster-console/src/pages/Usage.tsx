import type { ReactNode } from 'react';
import { Link as RouterLink, useOutletContext } from 'react-router-dom';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Button, Link } from '@mui/material';

import type { UsageRecord } from '~/api/types';
import { SelectFilter, TextFilter, useFilters } from '~/components/Filters';
import {
  color,
  Facts,
  Loading,
  LoadMore,
  Missing,
  Mono,
  TabHeader,
  Pill,
  RowsTable,
  Section,
  SourceLine,
  asMissing,
  text,
} from '~/components/ui';
import { bytes, mib, num, shortKey, time } from '~/format';
import { usePaged } from '~/hooks/usePaged';

import { useNodeNames } from './sandboxShared';
import type { SandboxesContext } from './SandboxesService';

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

  const ctx = useOutletContext<SandboxesContext | undefined>();
  const billed = p.items.some((r) => r.billed_cpu_s !== undefined || r.billed_ram_gib_s !== undefined);

  return (
    <>
      {ctx && <PathToDAC ctx={ctx} />}
      <TabHeader
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
              ...(billed
                ? [
                    {
                      label: 'Billed CPU-s · GiB-s',
                      align: 'right' as const,
                      render: (r: UsageRecord) =>
                        r.billed_cpu_s !== undefined
                          ? `${num(r.billed_cpu_s, 2)} · ${num(r.billed_ram_gib_s, 2)}`
                          : '—',
                    },
                  ]
                : []),
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
                  ...(r.billing_basis !== undefined || r.billed_cpu_s !== undefined
                    ? ([
                        [
                          'Billed (basis)',
                          `${num(r.billed_cpu_s, 3)} CPU-s · ${num(r.billed_ram_gib_s, 3)} GiB-s (${r.billing_basis ?? 'basis not given'})`,
                        ],
                        [
                          'Reserved',
                          `${num(r.reserved_cpu, 2)} CPU · ${mib(r.reserved_memory_mib)} over ${num(r.wall_s, 1)} s wall`,
                        ],
                      ] as [string, string][])
                    : []),
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
        record the node wrote, and its push status to the host's DAC agent. What DAC collected of them is above, from
        the DAC grouping collector.
      </SourceLine>
    </>
  );
}

/** A sandbox's usage on its way to a payout: measured, at the DAC agent, collected by DAC, charged. */
function PathToDAC({ ctx }: { ctx: SandboxesContext }) {
  const r = ctx.summary?.records_last_hour;
  const v = ctx.verification;
  const steps: { title: string; body: ReactNode }[] = [
    {
      title: '1 · Measured',
      body: 'The sandbox runtime writes one record per sandbox per minute, and a final one, signed by the sandbox node: the rows below.',
    },
    {
      title: '2 · At the host’s DAC agent',
      body: ctx.summary?.sections.records.missing ? (
        <Missing error={ctx.summary.sections.records.missing} compact />
      ) : r ? (
        `Last hour: ${num(r.pushed, 0)} pushed · ${num(r.pending, 0)} pending · ${num(r.failed, 0)} failed.`
      ) : (
        '…'
      ),
    },
    {
      title: '3 · Collected by DAC',
      body: ctx.verifyError ? (
        <Missing error={asMissing(ctx.verifyError)} compact />
      ) : !v ? (
        '…'
      ) : v.verified ? (
        `Last 24 h: ${num(v.verified.cpu_units, 0)} CPU · ${num(v.verified.ram_units, 0)} RAM units from ${v.registered.length} sandbox node(s) on the blockchain.`
      ) : (
        <Missing error={{ source: 'DAC collection of sandbox records', detail: v.why ?? '' }} compact />
      ),
    },
    {
      title: '4 · Charged',
      body: (
        <span>
          Payouts charge what DAC collected, at the cluster’s prices:{' '}
          <Link component={RouterLink} to="/revenue">
            Revenue
          </Link>
          , CPU and RAM.
        </span>
      ),
    },
  ];
  return (
    <Box sx={{ marginBottom: 2 }}>
      <Section title="From the sandbox runtime to payouts" subtitle="Where this service’s usage stands at each step.">
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 2 }}>
          {steps.map((st) => (
            <Stack key={st.title} spacing={0.5} minWidth={0}>
              <Typography sx={text.label}>{st.title}</Typography>
              <Typography component="div" sx={{ fontSize: 12.5 }}>
                {st.body}
              </Typography>
            </Stack>
          ))}
        </Box>
      </Section>
    </Box>
  );
}
