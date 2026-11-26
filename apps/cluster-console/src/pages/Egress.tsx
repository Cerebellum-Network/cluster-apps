import { Stack } from '@cluster-apps/ui';

import type { EgressEntry } from '~/api/types';
import { SelectFilter, useFilters } from '~/components/Filters';
import { color, CouldNotRead, Facts, Loading, LoadMore, Mono, Panel, Pill, RowsTable } from '~/components/ui';
import { bytes, num, shortTime, time } from '~/format';
import { usePaged } from '~/hooks/usePaged';

import { useNodeNames } from './sandboxShared';

const TONE = { allowed: 'success', denied: 'warning', error: 'danger', policy: 'neutral' } as const;
const WORD: Record<string, string> = { allowed: 'Allowed', denied: 'Denied', error: 'Failed', policy: 'Rule changed' };

/**
 * A rule added to or removed from a running sandbox's allow-list is logged as
 * `decision: "policy"`: an event about the rules, not a request, so it never
 * counts as traffic.
 */
const isRuleChange = (e: EgressEntry) => e.decision === 'policy';
const ruleText = (e: EgressEntry) => `${e.method ? `${e.method.replace(/,/g, ', ')} ` : ''}${e.host}${e.path ?? ''}`;

/** What sandboxes reached outside, and what was refused. Details open in place. */
export function Egress() {
  const f = useFilters(['decision', 'bucket', 'sandbox_id']);
  const name = useNodeNames();
  const p = usePaged<EgressEntry>('/egress/log', {
    decision: f.values.decision,
    bucket: f.values.bucket,
    sandbox_id: f.values.sandbox_id,
    limit: 100,
  });

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <SelectFilter
          label="Decision"
          value={f.values.decision}
          options={[
            ['allowed', 'Allowed'],
            ['denied', 'Denied'],
            ['error', 'Failed'],
            ['policy', 'Rule changes'],
          ]}
          onChange={(v) => f.set('decision', v)}
        />
      </Stack>
      {p.error && <CouldNotRead error={p.error} what="the egress log" />}
      {!p.loaded && !p.error && <Loading />}
      {p.loaded && (
        <Panel flush>
          <RowsTable
            rows={p.items}
            rowKey={(e) => `${e.id}`}
            empty={f.values.decision ? 'No request with this decision.' : 'No sandbox has reached outside yet.'}
            columns={[
              { label: 'Time', render: (e) => <span style={{ whiteSpace: 'nowrap' }}>{shortTime(e.ts)}</span> },
              {
                label: 'Decision',
                render: (e) => (
                  <Pill tone={TONE[e.decision as keyof typeof TONE] ?? 'neutral'}>
                    {WORD[e.decision] ?? e.decision}
                  </Pill>
                ),
              },
              {
                label: 'Request',
                render: (e) =>
                  isRuleChange(e) ? (
                    <span>
                      {e.reason === 'rule removed' ? 'Removed' : 'Added'} rule <Mono>{ruleText(e)}</Mono>
                    </span>
                  ) : (
                    <Mono>
                      {e.method} {e.host}
                      {e.path ?? ''}
                    </Mono>
                  ),
              },
              {
                label: 'Credential added',
                render: (e) =>
                  e.credential ? (
                    <Pill tone="primary">{e.credential}</Pill>
                  ) : (
                    <span style={{ color: color.textTertiary }}>none</span>
                  ),
              },
              { label: 'Customer', render: (e) => (e.bucket != null ? `Bucket ${e.bucket}` : '—') },
              { label: 'Why', render: (e) => (isRuleChange(e) ? '' : (e.reason ?? '')) },
            ]}
            detail={(e) =>
              isRuleChange(e) ? (
                <Facts
                  items={[
                    ['When', time(e.ts)],
                    ['Sandbox', <Mono key="s">{e.sandbox_id ?? '—'}</Mono>],
                    [
                      'Change',
                      `${e.reason === 'rule removed' ? 'Removed from' : 'Added to'} the sandbox’s allow-list while it ran`,
                    ],
                    ['Rule', <Mono key="r">{ruleText(e)}</Mono>],
                    ['Credential', e.credential ? `“${e.credential}”, added as a header by the egress proxy` : 'none'],
                  ]}
                />
              ) : (
                <Facts
                  items={[
                    ['When', time(e.ts)],
                    ['Sandbox', <Mono key="s">{e.sandbox_id ?? '—'}</Mono>],
                    ['Node', e.node ? name(e.node) : '—'],
                    ['Answer', e.status != null ? `HTTP ${e.status}` : 'none (refused before the request was sent)'],
                    ['Sent · received', `${bytes(e.bytes_up)} · ${bytes(e.bytes_down)}`],
                    ['Took', e.duration_ms != null ? `${num(e.duration_ms, 0)} ms` : '—'],
                    [
                      'Credential',
                      e.credential
                        ? `“${e.credential}”, a secret of bucket ${e.bucket}, added as a header by the egress proxy. Its value is never logged.`
                        : 'none',
                    ],
                  ]}
                />
              )
            }
          />
          <LoadMore cursor={p.cursor} onMore={p.loadMore} loading={p.loading} />
        </Panel>
      )}
    </Stack>
  );
}
