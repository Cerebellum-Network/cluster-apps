import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Tab, Tabs, ToggleButton, ToggleButtonGroup } from '@mui/material';

import type { FleetView } from '~/api/metricsTypes';
import type { LiveView, UsageView } from '~/api/types';
import { RankedBars, SERIES, TimeChart } from '~/components/charts';
import { useFilters } from '~/components/Filters';
import {
  CouldNotRead,
  Figure,
  Figures,
  Loading,
  Meter,
  PageHeader,
  Panel,
  SectionTitle,
  Status,
  text,
} from '~/components/ui';
import { gibHours, hoursNumber, mib, num, percent, plural, vcpuHours } from '~/format';
import { useView } from '~/hooks/useView';

import { BILLING_LABEL, BILLING_TONE, billingLines, billingReason } from './billing';
import { amountsSplit, laneOf } from './limits';
import { LiveNodes, LiveStatus, type MachineTotal } from './LiveNodes';
import { SandboxDrawer, useOpenSandbox } from './sandboxShared';

const TABS = [
  { to: '/sandboxes', label: 'All sandboxes' },
  { to: '/sandboxes/egress', label: 'Outbound requests' },
];

/**
 * The Sandboxes service: what runs where right now, how much of the
 * sandbox quota it requests and how much it uses above that, whether its use
 * is billed, and its use over time by customer and by node. Then every sandbox, and their outbound
 * requests.
 */
export function SandboxesService() {
  const { pathname } = useLocation();
  const [paused, setPaused] = useState(false);
  const [openId, open] = useOpenSandbox();
  const f = useFilters(['hours']);
  const hours = f.values.hours === '168' ? 168 : 24;

  const live = useView<LiveView>('/live', undefined, paused ? 0 : 1_000);
  const fleet = useView<FleetView>('/fleet', undefined, 60_000);
  const usage = useView<UsageView>('/usage', { hours }, 60_000);

  const machines = useMemo(() => {
    const m = new Map<string, MachineTotal>();
    for (const x of fleet.data?.machines ?? []) {
      if (x.host)
        m.set(x.host, {
          cpu: x.cpu_cores,
          memoryMiB: x.memory_total_bytes != null ? x.memory_total_bytes / 2 ** 20 : null,
        });
    }
    return m;
  }, [fleet.data]);

  const nodes = live.data?.nodes;
  const all = nodes?.flatMap((n) => n.sandboxes) ?? [];
  const running = all.filter((s) => s.status === 'running').length;
  const starting = all.length - running + (live.data?.unplaced.length ?? 0);
  const quotaCpu = nodes?.reduce((a, n) => a + (n.allocatable?.cpu ?? 0), 0) ?? 0;
  const quotaMem = nodes?.reduce((a, n) => a + (n.allocatable?.memory_mib ?? 0), 0) ?? 0;
  const resCpu = all.reduce((a, s) => a + s.resources.cpu, 0);
  const resMem = all.reduce((a, s) => a + s.resources.memory_mib, 0);
  const burstCpu = nodes?.reduce((a, n) => a + laneOf(n.sandboxes, 'cpu').burst, 0) ?? 0;
  const burstMem = nodes?.reduce((a, n) => a + laneOf(n.sandboxes, 'memory').burst, 0) ?? 0;
  // A backend before limits sends no split: the charts then show billed and measured only.
  const hasSplit = usage.data?.totals.burst_cpu_s !== undefined;
  const totals = usage.data ? amountsSplit(usage.data.totals) : null;
  const lines = usage.data ? billingLines(usage.data.billing) : [];
  const main = lines[0];
  const tab = [...TABS].reverse().find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`))?.to ?? TABS[0].to;

  const series = usage.data?.series ?? [];
  const starts = series.map((p) => Date.parse(p.start));
  const period = hours === 24 ? 'last 24 h' : 'last 7 days';

  return (
    <>
      <PageHeader
        title="Sandboxes"
        subtitle="What runs on each node right now, what it requests and uses, and whether that use is billed."
        actions={<LiveStatus readAt={live.data?.read_at} paused={paused} onPause={() => setPaused((p) => !p)} />}
      />
      {live.error && !live.data && <CouldNotRead error={live.error} what="sandboxes" />}
      {!live.data && !live.error && <Loading />}
      {live.data && (
        <Stack spacing={2}>
          <Figures columns={4}>
            <Figure
              label="Running now"
              value={num(running, 0)}
              sub={
                starting > 0
                  ? `${starting} starting`
                  : `on ${plural(nodes?.filter((n) => n.sandboxes.length).length ?? 0, 'node')}`
              }
            />
            <Figure
              label="vCPU requested"
              value={num(resCpu, 2)}
              unit={`of ${num(quotaCpu, 1)}`}
              sub={
                burstCpu > 0
                  ? `${percent(resCpu, quotaCpu)} of the sandbox quota · ${num(burstCpu, 2)} in use above requests`
                  : `${percent(resCpu, quotaCpu)} of the sandbox quota on ${plural(nodes?.length ?? 0, 'node')}`
              }
            >
              <Meter value={resCpu} max={quotaCpu} label="vCPU requested of the sandbox quota" />
            </Figure>
            <Figure
              label="Memory requested"
              value={num(resMem / 1024, 1)}
              unit={`of ${num(quotaMem / 1024, 1)} GiB`}
              sub={
                burstMem > 0
                  ? `${percent(resMem, quotaMem)} of the sandbox quota · ${mib(burstMem)} in use above requests`
                  : `${percent(resMem, quotaMem)} of the sandbox quota`
              }
            >
              <Meter value={resMem} max={quotaMem} label="Memory requested of the sandbox quota" />
            </Figure>
            <Figure
              label={`Billing, ${period}`}
              value={
                main ? (
                  <Status tone={BILLING_TONE[main.state]}>{BILLING_LABEL[main.state]}</Status>
                ) : usage.data ? (
                  '—'
                ) : (
                  '…'
                )
              }
              sub={
                main
                  ? billingReason(main.reason, main.nodes)
                  : usage.data
                    ? 'No sandbox ran in this period.'
                    : undefined
              }
              to="/revenue"
            />
          </Figures>
          {live.data.missing.length > 0 && (
            <CouldNotRead error={live.data.missing[0]} what="each sandbox’s latest minute" />
          )}

          <Panel
            title="Nodes"
            subtitle="Each node’s sandbox quota counts requests. A block per sandbox is sized by its request and filled by what it uses; use above the request runs on past the block. Open a node for each sandbox’s limit, or a block for its use over time."
          >
            <Box sx={{ margin: '0 -22px -20px' }}>
              <LiveNodes nodes={nodes} machines={machines} onOpen={(s) => open(s.id)} />
            </Box>
          </Panel>

          <Stack direction="row" alignItems="flex-end" justifyContent="space-between" sx={{ marginTop: 1 }}>
            <SectionTitle sub="Billed is what customers are charged: each sandbox’s request for as long as it runs, and burst when it uses more than its request. Measured is what sandboxes used.">
              Use over time
            </SectionTitle>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={`${hours}`}
              onChange={(_, v) => v && f.set('hours', v === '24' ? '' : v)}
              aria-label="Period"
              sx={{ marginBottom: '12px' }}
            >
              <ToggleButton value="24">24 h</ToggleButton>
              <ToggleButton value="168">7 days</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          {usage.error && <CouldNotRead error={usage.error} what="usage" />}
          {usage.data && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
                <Panel title="vCPU-hours per hour">
                  <TimeChart
                    starts={starts}
                    stepMs={usage.data.step_s * 1000}
                    series={[
                      {
                        key: 'b',
                        label: 'Billed',
                        color: SERIES.billed,
                        values: series.map((p) => p.billed_cpu_s),
                        total: vcpuHours(usage.data.totals.billed_cpu_s),
                      },
                      ...(hasSplit && totals
                        ? [
                            {
                              key: 'x',
                              label: 'of it burst',
                              color: SERIES.burst,
                              values: series.map((p) => p.burst_cpu_s ?? 0),
                              total: vcpuHours(totals.cpu.burst),
                            },
                          ]
                        : []),
                      {
                        key: 'm',
                        label: 'Measured',
                        color: SERIES.measured,
                        values: series.map((p) => p.cpu_s),
                        total: vcpuHours(usage.data.totals.cpu_s),
                      },
                    ]}
                    format={(x) => vcpuHours(x)}
                    axis={(x) => hoursNumber(x)}
                    label={`vCPU-hours per hour, billed, burst and measured, ${period}`}
                  />
                </Panel>
                <Panel title="GiB-hours per hour">
                  <TimeChart
                    starts={starts}
                    stepMs={usage.data.step_s * 1000}
                    series={[
                      {
                        key: 'b',
                        label: 'Billed',
                        color: SERIES.billed,
                        values: series.map((p) => p.billed_ram_gib_s),
                        total: gibHours(usage.data.totals.billed_ram_gib_s),
                      },
                      ...(hasSplit && totals
                        ? [
                            {
                              key: 'x',
                              label: 'of it burst',
                              color: SERIES.burst,
                              values: series.map((p) => p.burst_ram_gib_s ?? 0),
                              total: gibHours(totals.memory.burst),
                            },
                          ]
                        : []),
                      {
                        key: 'm',
                        label: 'Measured',
                        color: SERIES.measured,
                        values: series.map((p) => p.ram_gib_s),
                        total: gibHours(usage.data.totals.ram_gib_s),
                      },
                    ]}
                    format={(x) => gibHours(x)}
                    axis={(x) => hoursNumber(x)}
                    label={`GiB-hours per hour, billed, burst and measured, ${period}`}
                  />
                </Panel>
              </Box>
              {usage.data.totals.without_billed > 0 && (
                <Typography sx={{ ...text.caption }}>
                  {plural(usage.data.totals.without_billed, 'record')} came from a runtime that reports no billed
                  figures; they count as measured only.
                </Typography>
              )}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
                <Panel title="By customer" subtitle="Billed vCPU-hours.">
                  <RankedBars
                    rows={usage.data.by_bucket.slice(0, 6).map((b) => ({
                      key: `${b.bucket}`,
                      label: `Bucket ${b.bucket}`,
                      sub: `${plural(b.sandboxes, 'sandbox', 'sandboxes')} · ${gibHours(b.billed_ram_gib_s)}`,
                      value: b.billed_cpu_s,
                      display: vcpuHours(b.billed_cpu_s),
                      title: `Bucket ${b.bucket}: ${vcpuHours(b.billed_cpu_s)} billed${b.burst_cpu_s ? ` (${vcpuHours(b.burst_cpu_s)} burst)` : ''}, ${vcpuHours(b.cpu_s)} measured`,
                    }))}
                  />
                </Panel>
                <Panel title="By node" subtitle="Billed vCPU-hours, and whether DAC counts them.">
                  <RankedBars
                    rows={usage.data.by_node.map((n) => ({
                      key: n.node,
                      label: n.host || n.node.slice(0, 12),
                      sub: <Status tone={BILLING_TONE[n.billing]}>{BILLING_LABEL[n.billing]}</Status>,
                      value: n.billed_cpu_s,
                      display: vcpuHours(n.billed_cpu_s),
                      title: `${n.host}: ${vcpuHours(n.billed_cpu_s)} billed · ${BILLING_LABEL[n.billing]}: ${billingReason(n.reason)}`,
                    }))}
                  />
                </Panel>
              </Box>
            </>
          )}

          <Tabs
            value={tab}
            sx={{ marginTop: 2, borderBottom: '1px solid', borderColor: 'divider', minHeight: 40 }}
            aria-label="Sandboxes lists"
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
          <Outlet />
        </Stack>
      )}
      <SandboxDrawer id={openId} onClose={() => open(null)} />
    </>
  );
}
