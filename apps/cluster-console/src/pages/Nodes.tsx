import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Button } from '@mui/material';

import type { ApiError } from '~/api/client';
import type { ChainNode, ChainSnapshot, DACView, NodeView, NodesView } from '~/api/types';
import {
  Chip,
  color,
  Facts,
  Loading,
  Missing,
  Mono,
  PageHeader,
  Pill,
  RowsTable,
  Section,
  SourceLine,
  text,
} from '~/components/ui';
import { ago, bytes, cpu, mib, num, shortKey, time } from '~/format';
import { useView } from '~/hooks/useView';

import { workLine } from './dac';

const healthPill = (n: NodeView) =>
  n.healthy ? <Pill tone="success">Healthy</Pill> : <Pill tone="danger">Not healthy</Pill>;

function NodeCell({ n }: { n: NodeView }) {
  const name = n.chain?.host || n.host || shortKey(n.id);
  return (
    <Stack>
      <Typography sx={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{name}</Typography>
      {/* The node ID, when it is a key rather than the name already shown. */}
      {n.id !== name && n.id !== n.host && <Mono title={n.id}>{shortKey(n.id, 8, 6)}</Mono>}
    </Stack>
  );
}

function ChainCell({ c }: { c: ChainNode | null }) {
  if (!c) return <Typography sx={{ fontSize: 12.5, color: color.textTertiary }}>not matched</Typography>;
  return (
    <Stack>
      <Typography sx={{ fontSize: 12.5 }}>{c.mode} node</Typography>
      <Mono title={`node ${c.pub_key}\nprovider ${c.provider}`}>provider {shortKey(c.provider)}</Mono>
    </Stack>
  );
}

const capacity = (c: { cpu: number; memory_mib: number } | null | undefined) =>
  c ? `${cpu(c.cpu)} · ${mib(c.memory_mib)}` : '—';

function SandboxNodes({ nodes }: { nodes: NodeView[] }) {
  return (
    <Section
      flush
      title={`Sandbox runtime · ${nodes.length} node${nodes.length === 1 ? '' : 's'}`}
      subtitle="gVisor sandboxes. Allocatable from each node's report; allocated is the resource manager's sum of the node's live sandboxes."
    >
      <RowsTable
        rows={nodes}
        rowKey={(n) => n.id}
        empty="No node reports a sandbox runtime to the resource manager."
        columns={[
          { label: 'Node', render: (n) => <NodeCell n={n} /> },
          { label: 'Hardware', render: (n) => `${n.sandbox?.arch || '—'} · kernel ${n.sandbox?.kernel || '—'}` },
          {
            label: 'Runtimes',
            render: (n) => (
              <Stack>
                <span>{n.sandbox?.runtimes.join(', ') || '—'}</span>
                <Mono>runsc {n.sandbox?.runsc || '—'}</Mono>
              </Stack>
            ),
          },
          { label: 'Allocatable', render: (n) => capacity(n.sandbox?.allocatable) },
          {
            label: 'Allocated',
            render: (n) => (
              <Stack>
                <span>{capacity(n.sandbox?.allocated)}</span>
                <Typography sx={{ fontSize: 11.5, color: color.textSecondary }}>
                  node says {capacity(n.sandbox?.reported_allocated)}
                </Typography>
              </Stack>
            ),
          },
          {
            label: 'Sandboxes',
            align: 'right',
            render: (n) =>
              n.sandbox?.sandboxes
                ? `${n.sandbox.sandboxes.running} running · ${n.sandbox.sandboxes.total} total`
                : '—',
          },
          {
            label: 'Disk free',
            align: 'right',
            render: (n) => (n.sandbox?.disk_free_gib != null ? `${num(n.sandbox.disk_free_gib)} GiB` : '—'),
          },
          {
            label: 'Status',
            render: (n) => (
              <Stack spacing={0.25}>
                {healthPill(n)}
                <Typography sx={{ fontSize: 11.5, color: color.textSecondary }}>report {ago(n.last_seen)}</Typography>
              </Stack>
            ),
          },
          { label: 'On the blockchain', render: (n) => <ChainCell c={n.chain} /> },
        ]}
        detail={(n) => (
          <Facts
            items={[
              ['Node ID', <Mono key="id">{n.id}</Mono>],
              ['Endpoint', <Mono key="e">{n.sandbox?.endpoint || '—'}</Mono>],
              ['Module status', n.sandbox?.status || '—'],
              ['Last report', time(n.last_seen)],
              ['Other runtimes on the node', n.runtimes.filter((r) => r !== 'gvisor').join(', ') || 'none'],
              ['Storage node key', n.chain ? <Mono key="c">{n.chain.pub_key}</Mono> : 'not matched by host'],
              ['Provider', n.chain ? <Mono key="p">{n.chain.provider}</Mono> : '—'],
            ]}
          />
        )}
      />
    </Section>
  );
}

function InferenceNodes({ nodes }: { nodes: NodeView[] }) {
  return (
    <Section
      flush
      title={`Inference · ${nodes.length} node${nodes.length === 1 ? '' : 's'}`}
      subtitle="GPUs and models from each node's last report."
    >
      <RowsTable
        rows={nodes}
        rowKey={(n) => n.id}
        empty="No node reports an inference runtime."
        columns={[
          { label: 'Node', render: (n) => <NodeCell n={n} /> },
          {
            label: 'Hardware',
            render: (n) =>
              n.inference?.devices.length ? (
                n.inference.devices.map((d, i) => (
                  <div key={i}>
                    {d.model} · {bytes(d.vram_used_bytes)} of {bytes(d.vram_total_bytes)} VRAM
                  </div>
                ))
              ) : (
                <Typography sx={{ fontSize: 12.5, color: color.textSecondary }}>no local GPU (remote API)</Typography>
              ),
          },
          {
            label: 'Serving',
            render: (n) => {
              const ready = n.inference?.models.filter((m) => m.status === 'ready') ?? [];
              return ready.length ? (
                ready.map((m) => `${m.name} ${m.version}`).join(', ')
              ) : (
                <Typography sx={{ fontSize: 12.5, color: color.textSecondary }}>no model ready (standby)</Typography>
              );
            },
          },
          {
            label: 'Requests at once',
            align: 'right',
            render: (n) => {
              const ready = n.inference?.models.filter((m) => m.status === 'ready') ?? [];
              return num(
                ready.reduce((a, m) => a + (m.ceiling ?? 0), 0),
                0,
              );
            },
          },
          {
            label: 'In flight',
            align: 'right',
            render: (n) =>
              num(
                n.inference?.models.reduce((a, m) => a + (m.in_flight ?? 0), 0),
                0,
              ),
          },
          {
            label: 'Status',
            render: (n) => (
              <Stack spacing={0.25}>
                {healthPill(n)}
                <Typography sx={{ fontSize: 11.5, color: color.textSecondary }}>report {ago(n.last_seen)}</Typography>
              </Stack>
            ),
          },
        ]}
        detail={(n) => (
          <Stack spacing={1}>
            <Facts
              items={[
                ['Node ID', <Mono key="id">{n.id}</Mono>],
                ['Provider (report)', n.inference?.provider || '—'],
                ['Last report', time(n.last_seen)],
              ]}
            />
            <Typography sx={text.label}>Models in the report</Typography>
            {n.inference?.models.map((m) => (
              <Typography key={`${m.bucket}/${m.name}/${m.version}`} sx={{ fontSize: 12.5 }}>
                {m.name} {m.version} (bucket {m.bucket}) · {m.status} · ceiling {num(m.ceiling, 0)} · in flight{' '}
                {num(m.in_flight, 0)} · queue {num(m.queue, 0)}
              </Typography>
            ))}
          </Stack>
        )}
      />
    </Section>
  );
}

function AgentNodes({ nodes }: { nodes: NodeView[] }) {
  return (
    <Section flush title={`Agent runtime · ${nodes.length} node${nodes.length === 1 ? '' : 's'}`}>
      <RowsTable
        rows={nodes}
        rowKey={(n) => n.id}
        columns={[
          { label: 'Node', render: (n) => <NodeCell n={n} /> },
          { label: 'Isolates busy', align: 'right', render: (n) => num(n.agent?.isolates_busy, 0) },
          { label: 'Isolates warm', align: 'right', render: (n) => num(n.agent?.isolates_warm, 0) },
          {
            label: 'Status',
            render: (n) => (
              <Stack spacing={0.25}>
                {healthPill(n)}
                <Typography sx={{ fontSize: 11.5, color: color.textSecondary }}>report {ago(n.last_seen)}</Typography>
              </Stack>
            ),
          },
        ]}
      />
    </Section>
  );
}

function ChainRoster({
  nodes,
  reporting,
  compared,
  dac,
  dacError,
}: {
  nodes: ChainNode[];
  reporting: Map<string, NodeView>;
  compared: boolean;
  dac: DACView | null;
  dacError: ApiError | Error | null;
}) {
  const recorded = dac ? dac.eras.filter((e) => e.consumed).length : 0;
  return (
    <Section
      flush
      title={`On the blockchain · ${nodes.length}`}
      subtitle={
        <>
          The cluster&apos;s nodes on the blockchain.{' '}
          {compared
            ? 'Matched to the resource manager’s reports by host.'
            : 'The resource manager registry is missing, so these are not matched with it.'}{' '}
          Verified work is each node&apos;s provided usage in DAC, summed over the{' '}
          {dac ? `${recorded} of ${dac.eras.length}` : ''} eras of the last 24 h this console recorded.
        </>
      }
    >
      {dacError && (
        <Box sx={{ padding: '0 22px 12px' }}>
          <Missing error={dacError} compact />
        </Box>
      )}
      <RowsTable
        rows={nodes}
        rowKey={(n) => n.pub_key}
        columns={[
          { label: 'Node key', render: (n) => <Mono title={n.pub_key}>{shortKey(n.pub_key, 8, 6)}</Mono> },
          { label: 'Mode', render: (n) => n.mode },
          { label: 'Host', render: (n) => `${n.host}${n.http_port ? `:${n.http_port}` : ''}` },
          { label: 'Provider', render: (n) => <Mono title={n.provider}>{shortKey(n.provider)}</Mono> },
          {
            label: 'Resource manager report (by host)',
            render: (n) => {
              const r = reporting.get(n.pub_key);
              if (!compared) return '—';
              const kind = r?.sandbox ? 'sandbox' : r?.inference ? 'inference' : r?.agent ? 'agent' : 'compute';
              return r ? (
                <span>
                  same host as {kind} node <Mono title={r.id}>{shortKey(r.id)}</Mono>
                </span>
              ) : (
                <span style={{ color: color.textTertiary }}>none</span>
              );
            },
          },
          {
            label: 'Verified work, last 24 h',
            render: (n) => {
              if (!dac) return '—';
              const line = workLine(dac.nodes[n.pub_key.toLowerCase().replace(/^0x/, '')], bytes);
              return line ?? <span style={{ color: color.textTertiary }}>none in the recorded eras</span>;
            },
          },
        ]}
      />
    </Section>
  );
}

export function Nodes() {
  const v = useView<NodesView>('/nodes');
  const chain = useView<ChainSnapshot>('/chain', undefined, 60_000);
  const items = v.data?.items ?? [];
  const sandbox = items.filter((n) => n.sandbox);
  const inference = items.filter((n) => !n.sandbox && n.inference);
  const agent = items.filter((n) => !n.sandbox && !n.inference && n.agent);
  const registryMissing = !!v.data?.missing.some((m) => m.source.endsWith('/api/v1/nodes'));
  const allocationMissing = !!v.data?.missing.some((m) => m.source.endsWith('/api/v1/sandbox-nodes'));
  const dac = useView<DACView>('/dac', { hours: 24 }, 60_000);
  const reporting = new Map(items.filter((n) => n.chain).map((n) => [n.chain!.pub_key, n]));
  const unhealthy = items.filter((n) => !n.healthy).length;

  return (
    <>
      <PageHeader
        title="Nodes"
        subtitle="The resource manager's registry (nodes that reported in the last 30 s) and the cluster's nodes on the blockchain."
        actions={
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              v.refresh();
              chain.refresh();
              dac.refresh();
            }}
            disabled={v.loading}
          >
            Refresh
          </Button>
        }
      />
      {v.error && !v.data && <Missing error={v.error} />}
      {!v.data && !v.error && <Loading />}
      {v.data && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {registryMissing ? (
              <Chip tone="warn">registry missing</Chip>
            ) : (
              <>
                <Chip>{items.length} reporting to the resource manager</Chip>
                <Chip>
                  {sandbox.length} sandbox · {inference.length} inference · {agent.length} agent
                </Chip>
              </>
            )}
            {chain.data && <Chip>{chain.data.nodes.length} on the blockchain</Chip>}
            {unhealthy > 0 && <Chip tone="bad">{unhealthy} not healthy</Chip>}
          </Stack>
          {v.data.missing.map((m) => (
            <Missing key={m.source} error={m} />
          ))}
          {chain.error && <Missing error={chain.error} />}
          {!(registryMissing && allocationMissing) && <SandboxNodes nodes={sandbox} />}
          {inference.length > 0 && <InferenceNodes nodes={inference} />}
          {agent.length > 0 && <AgentNodes nodes={agent} />}
          {chain.data && (
            <ChainRoster
              nodes={chain.data.nodes}
              reporting={reporting}
              compared={!registryMissing}
              dac={dac.data}
              dacError={dac.error}
            />
          )}
          <Box>
            <SourceLine>
              Not shown, no source yet: reporting history over 30 days and underperforming (the resource manager keeps
              only the last report), in cluster since and stake (needs a blockchain history read), disk per storage node
              (node metrics). A node that stops reporting disappears from the registry list.
            </SourceLine>
          </Box>
        </Stack>
      )}
    </>
  );
}
