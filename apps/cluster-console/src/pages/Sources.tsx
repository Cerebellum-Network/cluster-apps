import { useParams } from 'react-router-dom';
import { Stack, Typography } from '@cluster-apps/ui';

import type { SourceRow } from '~/api/types';
import { Loading, Missing, Mono, PageHeader, Pill, RowsTable, Section, text, type Tone } from '~/components/ui';
import { useView } from '~/hooks/useView';

const KIND: Record<SourceRow['kind'], [string, Tone]> = {
  blockchain: ['Blockchain read', 'primary'],
  'resource-manager': ['Resource manager', 'success'],
  'egress-proxy': ['Egress proxy', 'success'],
  dac: ['DAC', 'primary'],
  'console-backend': ['Console backend', 'neutral'],
  missing: ['No source yet', 'warning'],
};

function SourceTable({ rows }: { rows: SourceRow[] }) {
  return (
    <RowsTable
      rows={rows}
      rowKey={(r) => r.screen + r.field}
      columns={[
        { label: 'Screen', render: (r) => r.screen, width: 120 },
        { label: 'Number or column', render: (r) => r.field },
        {
          label: 'Backed by',
          render: (r) => <Pill tone={KIND[r.kind]?.[1] ?? 'neutral'}>{KIND[r.kind]?.[0] ?? r.kind}</Pill>,
          width: 150,
        },
        {
          label: 'Route and table',
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
  );
}

/** What backs each number (the canvas's z1 board), from the console backend. */
export function Sources() {
  const v = useView<{ items: SourceRow[] }>('/sources', undefined, 0);
  return (
    <>
      <PageHeader
        title="What backs each number"
        subtitle="Every number and column in this console, and the source it is read from; a missing source says why."
      />
      {v.error && <Missing error={v.error} />}
      {!v.data && !v.error && <Loading />}
      {v.data && (
        <Section flush>
          <SourceTable rows={v.data.items} />
        </Section>
      )}
    </>
  );
}

const SCREENS: Record<string, { title: string; screen: string; canvas: string }> = {
  storage: { title: 'Storage', screen: 'Storage', canvas: 'disk per node and the fill projection (canvas board s1)' },
  delivery: { title: 'Delivery', screen: 'Delivery', canvas: 'served, from cache, per cache node (canvas board s2)' },
  customers: {
    title: 'Customers',
    screen: 'Customers',
    canvas: 'plan, usage, limits, storage quota and deposit per customer (boards e1, e2)',
  },
  plans: { title: 'Plans', screen: 'Plans', canvas: 'Free and Pro: fee, included use and limits (board e0)' },
  requests: {
    title: 'Requests',
    screen: 'Requests',
    canvas:
      'nodes waiting to join and approving them, invites; the provider’s side of joining is in the Provider role (boards d1, d2; pj1, h2, pj3, p2)',
  },
  agents: {
    title: 'Agents',
    screen: 'Agents',
    canvas: 'a service entry under Services (board Side); its agent runtime nodes are listed under Nodes',
  },
  team: { title: 'Team', screen: 'Team', canvas: 'who signs for the cluster and how many must approve (board n1)' },
  rules: { title: 'Rules', screen: 'Rules', canvas: 'rules and price votes, later (boards a2, g1)' },
};

/** A canvas screen with no source today: says so, and why, instead of numbers. */
export function MissingScreen() {
  const { screen = '' } = useParams();
  const meta = SCREENS[screen];
  const v = useView<{ items: SourceRow[] }>('/sources', undefined, 0);
  if (!meta) return <Missing error="Unknown screen." />;
  const rows = (v.data?.items ?? []).filter((r) => r.screen === meta.screen);
  return (
    <>
      <PageHeader title={meta.title} subtitle={`On the canvas: ${meta.canvas}.`} />
      <Stack spacing={2}>
        <Missing
          error={{
            source: meta.title,
            detail:
              'No source this console backend can read today, so this screen shows no numbers. The rows below say what each would need.',
          }}
        />
        {v.error && <Missing error={v.error} />}
        {v.data && (
          <Section flush>
            <SourceTable rows={rows} />
          </Section>
        )}
      </Stack>
    </>
  );
}
