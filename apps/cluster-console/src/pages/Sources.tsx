import { Stack, Typography } from '@cluster-apps/ui';

import type { DACView, SourceRow } from '~/api/types';
import {
  CouldNotRead,
  Facts,
  Loading,
  Mono,
  PageHeader,
  Panel,
  Pill,
  RowsTable,
  text,
  type Tone,
} from '~/components/ui';
import { shortKey, time } from '~/format';
import { useView } from '~/hooks/useView';

const KIND: Record<SourceRow['kind'] | 'metrics', [string, Tone]> = {
  blockchain: ['Blockchain', 'primary'],
  'resource-manager': ['Resource manager', 'success'],
  'egress-proxy': ['Egress proxy', 'success'],
  dac: ['DAC', 'primary'],
  metrics: ['Node metrics', 'success'],
  'console-backend': ['Console backend', 'neutral'],
  missing: ['Not available yet', 'warning'],
};

/**
 * Data sources (the canvas's z1): for a reviewer, every number to its source,
 * and the screens and fields that have none yet. Internals live here, not on
 * the manager's screens.
 */
export function Sources() {
  const v = useView<{ items: SourceRow[] }>('/sources', undefined, 0);
  const dac = useView<DACView>('/dac', { hours: 24 }, 0);
  const rows = v.data?.items ?? [];
  const live = rows.filter((r) => r.kind !== 'missing');
  const missing = rows.filter((r) => r.kind === 'missing');
  return (
    <>
      <PageHeader
        title="Data sources"
        subtitle="Where every number in this console comes from, and what is not available yet."
      />
      {v.error && <CouldNotRead error={v.error} what="the source list" />}
      {!v.data && !v.error && <Loading />}
      {v.data && (
        <Stack spacing={2}>
          <Panel flush title="Numbers and their sources">
            <RowsTable
              rows={live}
              rowKey={(r) => r.screen + r.field}
              columns={[
                { label: 'Screen', render: (r) => r.screen, width: 120 },
                { label: 'Number or column', render: (r) => r.field },
                {
                  label: 'From',
                  render: (r) => <Pill tone={KIND[r.kind]?.[1] ?? 'neutral'}>{KIND[r.kind]?.[0] ?? r.kind}</Pill>,
                  width: 150,
                },
                {
                  label: 'Route',
                  render: (r) =>
                    r.route ? (
                      <Stack>
                        <Mono>{r.route}</Mono>
                        {r.table && <Typography sx={text.caption}>{r.table}</Typography>}
                      </Stack>
                    ) : (
                      '—'
                    ),
                },
                { label: 'Note', render: (r) => r.note ?? '' },
              ]}
            />
          </Panel>
          <Panel
            flush
            title="Not available yet"
            subtitle="What each would need. The screens show these as missing, never as zero."
          >
            <RowsTable
              rows={missing}
              rowKey={(r) => r.screen + r.field}
              columns={[
                { label: 'Screen', render: (r) => r.screen, width: 120 },
                { label: 'Number or column', render: (r) => r.field },
                { label: 'Needs', render: (r) => r.note ?? '' },
              ]}
            />
          </Panel>
          <Panel title="DAC grouping collector">
            {dac.error && <CouldNotRead error={dac.error} what="the collector" />}
            {dac.data && (
              <Facts
                items={[
                  [
                    'Node key',
                    <Mono key="k" title={dac.data.collector.key}>
                      {shortKey(dac.data.collector.key, 10, 6)}
                    </Mono>,
                  ],
                  ['Address', <Mono key="u">{dac.data.collector.url}</Mono>],
                  [
                    'Found',
                    dac.data.collector.from === 'blockchain'
                      ? 'On the blockchain: a storage node of the cluster names it, and its node record gives the address. Every page carries its signature, checked here.'
                      : 'Set in the console backend’s config.',
                  ],
                  [
                    'Routes',
                    <Mono key="r">GET /activity/v1/eras · GET /activity/v1/ehds/traverse/&#123;era&#125;</Mono>,
                  ],
                  [
                    'Recorded since',
                    `${time(dac.data.kept_since)}. The collector serves an era's report only for its last few eras, so the console backend records each one while it is served, in memory.`,
                  ],
                ]}
              />
            )}
          </Panel>
        </Stack>
      )}
    </>
  );
}
