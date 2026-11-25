import { useMemo } from 'react';
import { Stack, Typography } from '@cluster-apps/ui';
import { Button, ToggleButton, ToggleButtonGroup } from '@mui/material';

import type { Sandbox } from '~/api/types';
import { SelectFilter, TextFilter, useFilters } from '~/components/Filters';
import { Loading, LoadMore, Missing, Mono, TabHeader, RowsTable, Section, SourceLine, color } from '~/components/ui';
import { cpu, mib, num, seconds, time } from '~/format';
import { usePaged } from '~/hooks/usePaged';

import { NodeName, SandboxDetail, StatusPill, useNodeNames } from './sandboxShared';

const STATUSES: [string, string][] = [
  ['starting', 'Starting'],
  ['running', 'Running'],
  ['unknown', 'Unknown'],
  ['terminated', 'Terminated'],
  ['failed', 'Failed'],
];

export function Sandboxes() {
  const f = useFilters(['status', 'node', 'bucket', 'group']);
  const name = useNodeNames();
  const params = { status: f.values.status, node: f.values.node, bucket: f.values.bucket, limit: 100 };
  const p = usePaged<Sandbox>('/sandboxes', params);
  const group = f.values.group || 'none';

  const rows = useMemo(() => {
    if (group === 'none') return p.items;
    const keyOf = (s: Sandbox) => (group === 'node' ? (s.node ?? '') : `${s.bucket}`);
    return [...p.items].sort((a, b) => keyOf(a).localeCompare(keyOf(b)) || b.created_at.localeCompare(a.created_at));
  }, [p.items, group]);

  const header = (s: Sandbox, i: number) => {
    if (group === 'none') return null;
    const k = group === 'node' ? (s.node ?? '') : `${s.bucket}`;
    const prev = i > 0 ? rows[i - 1] : null;
    const pk = prev ? (group === 'node' ? (prev.node ?? '') : `${prev.bucket}`) : null;
    if (pk === k) return null;
    const inGroup = rows.filter((r) => (group === 'node' ? (r.node ?? '') : `${r.bucket}`) === k);
    const running = inGroup.filter((r) => r.status === 'running');
    const label = group === 'node' ? `Node ${name(k || null)}` : `Customer bucket ${k}`;
    return (
      <span>
        {label}{' '}
        <span style={{ fontWeight: 400, color: color.textSecondary }}>
          · {inGroup.length} shown · {running.length} running · {cpu(running.reduce((a, r) => a + r.resources.cpu, 0))},{' '}
          {mib(running.reduce((a, r) => a + r.resources.memory_mib, 0))} running
        </span>
      </span>
    );
  };

  return (
    <>
      <TabHeader
        subtitle="Every sandbox on the cluster, across customer buckets, newest first. Click a row for its spec, egress rules and placement."
        actions={
          <Button size="small" variant="outlined" onClick={p.refresh} disabled={p.loading}>
            Refresh
          </Button>
        }
      />
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ marginBottom: 2 }} flexWrap="wrap" useFlexGap>
        <SelectFilter label="Status" value={f.values.status} options={STATUSES} onChange={(v) => f.set('status', v)} />
        <TextFilter label="Customer bucket" value={f.values.bucket} onChange={(v) => f.set('bucket', v)} width={150} />
        <TextFilter label="Node ID" value={f.values.node} onChange={(v) => f.set('node', v)} width={220} />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={group}
          onChange={(_, v) => v && f.set('group', v === 'none' ? '' : v)}
        >
          <ToggleButton value="none">List</ToggleButton>
          <ToggleButton value="node">By node</ToggleButton>
          <ToggleButton value="bucket">By bucket</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {p.error && <Missing error={p.error} />}
      {!p.loaded && !p.error && <Loading />}
      {p.loaded && (
        <Section flush>
          <RowsTable
            rows={rows}
            rowKey={(s) => s.id}
            groupHeader={header}
            empty="No sandbox matches."
            columns={[
              { label: 'Sandbox', render: (s) => <Mono title={s.id}>{s.id}</Mono> },
              { label: 'Status', render: (s) => <StatusPill status={s.status} /> },
              { label: 'Bucket', align: 'right', render: (s) => s.bucket },
              { label: 'Node', render: (s) => <NodeName id={s.node} name={name} /> },
              { label: 'Image', render: (s) => <Mono>{s.image}</Mono> },
              { label: 'Size', render: (s) => `${cpu(s.resources.cpu)} · ${mib(s.resources.memory_mib)}` },
              { label: 'Created', render: (s) => time(s.created_at) },
              {
                label: 'Ran',
                render: (s) => (
                  <Stack>
                    <span>{s.usage ? seconds(s.usage.wall_s) : '—'}</span>
                    {s.startup_ms != null && (
                      <Typography sx={{ fontSize: 11.5, color: color.textSecondary }}>
                        start {num(s.startup_ms, 0)} ms
                      </Typography>
                    )}
                  </Stack>
                ),
              },
              { label: 'Exit reason', render: (s) => s.exit_reason ?? '—' },
              { label: 'CPU-s', align: 'right', render: (s) => num(s.usage?.cpu_s, 2) },
              { label: 'GiB-s', align: 'right', render: (s) => num(s.usage?.ram_gib_s, 2) },
            ]}
            detail={(s) => <SandboxDetail s={s} name={name} />}
          />
          <LoadMore cursor={p.cursor} onMore={p.loadMore} loading={p.loading} />
        </Section>
      )}
      <SourceLine>
        Source: resource manager GET /api/v1/sandboxes (table sandboxes), read with the console backend's read-only key.
        Usage is the node's last report while running and the final record after the end.
      </SourceLine>
    </>
  );
}
