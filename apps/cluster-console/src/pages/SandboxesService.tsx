import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Box, Stack } from '@cluster-apps/ui';
import { Button, Tab, Tabs } from '@mui/material';

import type { ApiError } from '~/api/client';
import type { ChainSnapshot, DACView, NodesView, Summary } from '~/api/types';
import { asMissing, PageHeader, Stat } from '~/components/ui';
import { mib, num } from '~/format';
import { useView } from '~/hooks/useView';

import { sandboxVerification, type SandboxVerification } from './dac';

/** What the service page has read, for its tabs (useOutletContext). */
export interface SandboxesContext {
  summary: Summary | null;
  verification: SandboxVerification | null;
  verifyError: ApiError | Error | null;
}

const TABS = [
  { to: '/sandboxes', label: 'Sandboxes' },
  { to: '/sandboxes/placements', label: 'Placements' },
  { to: '/sandboxes/egress', label: 'Egress' },
  { to: '/sandboxes/usage', label: 'Usage' },
];

const pct = (a: number, b: number) => (b > 0 ? ` (${Math.round((100 * a) / b)}%)` : '');

/**
 * The Sandboxes service (a service under Services, as Storage and Inference
 * are): its capacity in its own unit, its usage up to DAC, then its tabs.
 */
export function SandboxesService() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const summary = useView<Summary>('/summary');
  const nodes = useView<NodesView>('/nodes', undefined, 60_000);
  const chain = useView<ChainSnapshot>('/chain', undefined, 60_000);
  const dac = useView<DACView>('/dac', { hours: 24 }, 60_000);
  const s = summary.data;
  const tab = [...TABS].reverse().find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`))?.to ?? TABS[0].to;

  const refresh = () => [summary, nodes, chain, dac].forEach((v) => v.refresh());
  const loading = summary.loading || nodes.loading || chain.loading || dac.loading;

  const verification =
    nodes.data && chain.data && dac.data ? sandboxVerification(nodes.data, chain.data, dac.data) : null;
  const verifyError = nodes.error ?? chain.error ?? dac.error;

  return (
    <>
      <PageHeader
        title="Sandboxes"
        subtitle="gVisor sandboxes the cluster runs for customer buckets: capacity, the usage they recorded up to DAC, then each sandbox, where it was placed and what it reached outside."
        actions={
          <Button size="small" variant="outlined" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        }
      />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 2, marginBottom: 2 }}>
        <Stat
          label="Sandbox nodes"
          value={s ? `${num(s.nodes_healthy, 0)} of ${num(s.nodes, 0)}` : '…'}
          sub="healthy, reporting a sandbox runtime"
          source="resource manager · sandbox-nodes"
          missing={s?.sections.sandbox_nodes.missing ?? (summary.error ? asMissing(summary.error) : null)}
          onClick={() => nav('/nodes')}
        />
        <Stat
          label="CPU"
          value={s?.cpu ? `${num(s.cpu.allocated, 2)} of ${num(s.cpu.allocatable, 2)}` : '…'}
          sub={s?.cpu ? `allocated to live sandboxes${pct(s.cpu.allocated, s.cpu.allocatable)}` : undefined}
          source="resource manager · sandbox-nodes"
          missing={s?.sections.sandbox_nodes.missing}
        />
        <Stat
          label="Memory"
          value={s?.memory_mib ? `${mib(s.memory_mib.allocated)} of ${mib(s.memory_mib.allocatable)}` : '…'}
          sub={
            s?.memory_mib
              ? `allocated to live sandboxes${pct(s.memory_mib.allocated, s.memory_mib.allocatable)}`
              : undefined
          }
          source="resource manager · sandbox-nodes"
          missing={s?.sections.sandbox_nodes.missing}
        />
        <Stat
          label="Running"
          value={s ? `${num(s.sandboxes_running, 0)}${s.sections.sandboxes.truncated ? '+' : ''}` : '…'}
          sub="sandboxes, all customer buckets"
          source="resource manager · sandboxes?status=running"
          missing={s?.sections.sandboxes.missing}
          onClick={() => nav('/sandboxes?status=running')}
        />
        <Stat
          label="Egress, last hour"
          value={s?.egress_last_hour ? `${num(s.egress_last_hour.allowed, 0)} allowed` : '…'}
          sub={
            s?.egress_last_hour
              ? `${num(s.egress_last_hour.denied, 0)} denied · ${num(s.egress_last_hour.error, 0)} error${s.sections.egress.truncated ? ' (at least)' : ''}`
              : undefined
          }
          source="egress proxy · log"
          missing={s?.sections.egress.missing}
          onClick={() => nav('/sandboxes/egress')}
        />
        <Stat
          label="Usage records, last hour"
          value={s?.records_last_hour ? `${num(s.records_last_hour.pushed, 0)} at the DAC agent` : '…'}
          sub={
            s?.records_last_hour
              ? `${num(s.records_last_hour.pending, 0)} pending · ${num(s.records_last_hour.failed, 0)} failed`
              : undefined
          }
          source="resource manager · usage-records (the node's push to its host's DAC agent)"
          missing={s?.sections.records.missing}
          onClick={() => nav('/sandboxes/usage')}
        />
        <Box sx={{ gridColumn: 'span 2', display: 'grid' }}>
          <Stat
            label="Verified by DAC, last 24 h"
            value={
              verification?.verified
                ? `${num(verification.verified.cpu_units, 0)} CPU · ${num(verification.verified.ram_units, 0)} RAM units`
                : '…'
            }
            sub={
              verification?.verified
                ? `${verification.registered.length} of ${verification.sandboxNodes.length} sandbox nodes are nodes of the cluster on the blockchain · charged in Revenue, CPU and RAM`
                : undefined
            }
            source="DAC grouping collector · EHD per era, provided usage per node; sandbox node IDs against the blockchain roster"
            missing={
              verifyError
                ? asMissing(verifyError)
                : verification && !verification.verified
                  ? { source: 'DAC collection of sandbox records', detail: verification.why ?? '' }
                  : null
            }
            onClick={() => nav('/sandboxes/usage')}
          />
        </Box>
      </Box>
      <Tabs
        value={tab}
        sx={{ marginBottom: 2, borderBottom: '1px solid', borderColor: 'divider', minHeight: 40 }}
        aria-label="Sandboxes"
      >
        {TABS.map((t) => (
          <Tab
            key={t.to}
            value={t.to}
            label={t.label}
            component={NavLink}
            to={t.to}
            end
            sx={{ minHeight: 40, textTransform: 'none', fontSize: 14 }}
          />
        ))}
      </Tabs>
      <Stack>
        <Outlet context={{ summary: s, verification, verifyError } satisfies SandboxesContext} />
      </Stack>
    </>
  );
}
