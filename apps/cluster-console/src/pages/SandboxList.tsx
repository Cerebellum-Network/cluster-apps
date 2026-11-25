import { Stack } from '@cluster-apps/ui';

import type { Sandbox } from '~/api/types';
import { SelectFilter, TextFilter, useFilters } from '~/components/Filters';
import { CouldNotRead, Loading, LoadMore, Mono, Panel, RowsTable } from '~/components/ui';
import { mib, num, seconds, shortTime, vcpuTime } from '~/format';
import { usePaged } from '~/hooks/usePaged';

import { StatusPill, useNodeNames, useOpenSandbox } from './sandboxShared';

const STATUSES: [string, string][] = [
  ['running', 'Running'],
  ['starting', 'Starting'],
  ['terminated', 'Ended'],
  ['failed', 'Failed'],
  ['unknown', 'Unknown'],
];

/** Every sandbox, newest first. A row opens its drawer. */
export function SandboxList() {
  const f = useFilters(['status', 'bucket']);
  const name = useNodeNames();
  const [, open] = useOpenSandbox();
  const p = usePaged<Sandbox>('/sandboxes', { status: f.values.status, bucket: f.values.bucket, limit: 50 });
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <SelectFilter label="Status" value={f.values.status} options={STATUSES} onChange={(v) => f.set('status', v)} />
        <TextFilter label="Customer bucket" value={f.values.bucket} onChange={(v) => f.set('bucket', v)} width={160} />
      </Stack>
      {p.error && <CouldNotRead error={p.error} what="sandboxes" />}
      {!p.loaded && !p.error && <Loading />}
      {p.loaded && (
        <Panel flush>
          <RowsTable
            rows={p.items}
            rowKey={(s) => s.id}
            onOpen={(s) => open(s.id)}
            empty={
              f.values.status || f.values.bucket ? 'No sandbox matches.' : 'No sandbox has run on this cluster yet.'
            }
            columns={[
              { label: 'Sandbox', render: (s) => <Mono title={s.id}>…{s.id.slice(-8)}</Mono> },
              { label: 'Status', render: (s) => <StatusPill status={s.status} /> },
              { label: 'Customer', render: (s) => `Bucket ${s.bucket}` },
              { label: 'Node', render: (s) => (s.node ? name(s.node) : '—') },
              { label: 'Size', render: (s) => `${num(s.resources.cpu, 2)} vCPU · ${mib(s.resources.memory_mib)}` },
              { label: 'Started', render: (s) => shortTime(s.started_at ?? s.created_at) },
              { label: 'Ran', align: 'right', render: (s) => (s.usage ? seconds(s.usage.wall_s) : '—') },
              {
                label: 'Billed',
                align: 'right',
                render: (s) => (s.usage?.billed_cpu_s != null ? vcpuTime(s.usage.billed_cpu_s) : s.usage ? '—' : ''),
              },
            ]}
          />
          <LoadMore cursor={p.cursor} onMore={p.loadMore} loading={p.loading} />
        </Panel>
      )}
    </Stack>
  );
}
