import { Box, Stack, Typography } from '@cluster-apps/ui';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';

import type { DACEra, DACView, UsageView } from '~/api/types';
import { EraStrip, SERIES, TimeChart } from '~/components/charts';
import { useFilters } from '~/components/Filters';
import {
  color,
  CouldNotRead,
  Figure,
  Figures,
  Loading,
  NotYet,
  PageHeader,
  Panel,
  RowsTable,
  SectionTitle,
  Status,
  text,
} from '~/components/ui';
import { bytes, compact, num, shortTime } from '~/format';
import { useView } from '~/hooks/useView';

import { BILLING_LABEL, BILLING_TONE, billingLines, billingReason } from './billing';
import { byDay, type Day } from './dac';

const SEALED = new Set(['ERA_PROCESSED', 'ERA_INSPECTED', 'ERA_PAID', 'ERA_EMPTY']);

/** The eras of a window, oldest first, as chart points; an era not recorded is a gap. */
function perEra(eras: DACEra[], pick: (e: NonNullable<DACEra['consumed']>) => number) {
  const ordered = [...eras].sort((a, b) => a.start.localeCompare(b.start));
  return {
    starts: ordered.map((e) => Date.parse(e.start)),
    values: ordered.map((e) => (e.consumed ? pick(e.consumed) : null)),
  };
}

/**
 * Revenue (canvas f1, Dragon 2 T28): is DAC verifying the cluster's work, and
 * what it verified, era by era. Money needs payout receipts, which are not
 * read yet; that is said once.
 */
export function Revenue() {
  const f = useFilters(['hours']);
  const hours = f.values.hours === '168' ? 168 : 24;
  const v = useView<DACView>('/dac', { hours }, 60_000);
  const usage = useView<UsageView>('/usage', { hours }, 60_000);
  const d = v.data;
  const period = hours === 24 ? 'last 24 h' : 'last 7 days';
  const done = d?.eras.filter((e) => e.status !== 'ERA_IN_PROGRESS') ?? [];
  const sealed = done.filter((e) => SEALED.has(e.status)).length;
  const paid = done.filter((e) => e.status === 'ERA_PAID').length;
  const recorded = d?.eras.filter((e) => e.consumed).length ?? 0;
  const lines = usage.data ? billingLines(usage.data.billing) : [];
  // Usage sums cover only the eras whose report this backend recorded.
  const covered = recorded < done.length ? `${recorded} of ${done.length} eras recorded` : period;

  const delivered = d ? perEra(d.eras, (u) => u.transferred_bytes) : null;
  const cpuUnits = d ? perEra(d.eras, (u) => u.cpu_units) : null;
  const gpuUnits = d ? perEra(d.eras, (u) => u.gpu_units) : null;

  return (
    <>
      <PageHeader
        title="Revenue"
        subtitle="Whether DAC verifies the cluster’s work, era by era, and what it verified. Days are UTC."
        updatedAt={v.updatedAt}
        onRefresh={() => [v, usage].forEach((x) => x.refresh())}
        refreshing={v.loading}
        actions={
          <ToggleButtonGroup
            size="small"
            exclusive
            value={`${hours}`}
            onChange={(_, val) => val && f.set('hours', val === '24' ? '' : val)}
            aria-label="Period"
          >
            <ToggleButton value="24">24 h</ToggleButton>
            <ToggleButton value="168">7 days</ToggleButton>
          </ToggleButtonGroup>
        }
      />
      {v.error && !d && <CouldNotRead error={v.error} what="eras" />}
      {!d && !v.error && <Loading />}
      {d && (
        <Stack spacing={2}>
          <Figures columns={4}>
            <Figure
              label={`Eras verified, ${period}`}
              value={`${num(sealed, 0)} of ${num(done.length, 0)}`}
              sub={`${num(paid, 0)} paid · ${d.eras.length - done.length} in progress`}
            />
            <Figure
              label={`Data delivered, ${covered}`}
              value={bytes(d.consumed.transferred_bytes)}
              sub={`${bytes(d.consumed.stored_bytes)} stored · ${compact(d.consumed.gets)} reads · ${compact(d.consumed.puts)} writes`}
            />
            <Figure
              label={`Compute verified, ${covered}`}
              value={compact(d.consumed.cpu_units)}
              unit="CPU units"
              sub={`${compact(d.consumed.ram_units)} RAM units · ${compact(d.consumed.gpu_units)} GPU units`}
            />
            <Figure
              label="Earned"
              value="—"
              sub={
                <NotYet why="Collected, your reserve and providers paid come from each era's payout receipt on the blockchain (DdcPayouts) and the CERE rate. The console backend does not read them yet.">
                  in CERE and USD
                </NotYet>
              }
            />
          </Figures>

          <Panel
            title="Every era"
            subtitle={`One cell per era, by the status DAC gives it. ${recorded < done.length ? `Usage below covers the ${recorded} eras recorded since ${shortTime(d.kept_since)}.` : ''}`}
          >
            <EraStrip eras={d.eras} />
          </Panel>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
            <Panel title="Data delivered per era">
              {delivered && (
                <TimeChart
                  starts={delivered.starts}
                  stepMs={20 * 60_000}
                  series={[
                    {
                      key: 'b',
                      label: 'Delivered',
                      color: SERIES.one,
                      values: delivered.values,
                      total: bytes(d.consumed.transferred_bytes),
                    },
                  ]}
                  format={(x) => bytes(x)}
                  axis={(x) => bytes(x).replace(' ', '')}
                  label="Bytes delivered per era"
                  height={150}
                  tableLabel="Era start"
                />
              )}
            </Panel>
            <Panel title="CPU units per era">
              {cpuUnits && (
                <TimeChart
                  starts={cpuUnits.starts}
                  stepMs={20 * 60_000}
                  series={[
                    {
                      key: 'c',
                      label: 'CPU units',
                      color: SERIES.one,
                      values: cpuUnits.values,
                      total: compact(d.consumed.cpu_units),
                    },
                  ]}
                  format={(x) => compact(x)}
                  axis={(x) => compact(x)}
                  label="CPU units verified per era"
                  height={150}
                  tableLabel="Era start"
                />
              )}
            </Panel>
            <Panel title="GPU units per era">
              {gpuUnits && (
                <TimeChart
                  starts={gpuUnits.starts}
                  stepMs={20 * 60_000}
                  series={[
                    {
                      key: 'g',
                      label: 'GPU units',
                      color: SERIES.one,
                      values: gpuUnits.values,
                      total: compact(d.consumed.gpu_units),
                    },
                  ]}
                  format={(x) => compact(x)}
                  axis={(x) => compact(x)}
                  label="GPU units verified per era"
                  height={150}
                  tableLabel="Era start"
                />
              )}
            </Panel>
          </Box>

          <Panel title="Sandbox usage" subtitle="Whether DAC counts what sandboxes use, so payouts charge for it.">
            {usage.error && <CouldNotRead error={usage.error} what="sandbox usage" />}
            {usage.data && lines.length === 0 && (
              <Typography sx={text.secondary}>No sandbox ran in this period.</Typography>
            )}
            <Stack spacing={1}>
              {lines.map((l) => (
                <Stack
                  key={l.state + l.reason}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={{ xs: 0.5, sm: 2 }}
                  alignItems={{ sm: 'center' }}
                >
                  <Box sx={{ width: 220, flexShrink: 0 }}>
                    <Status tone={BILLING_TONE[l.state]}>{BILLING_LABEL[l.state]}</Status>
                  </Box>
                  <Typography sx={{ ...text.secondary, color: color.text }}>
                    {billingReason(l.reason, l.nodes)}
                    {lines.length > 1 && (
                      <span style={{ color: color.textSecondary }}> {Math.round(l.share * 100)}% of billed use.</span>
                    )}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Panel>

          <SectionTitle sub="Open a day for its eras.">By day</SectionTitle>
          <Panel flush>
            <RowsTable
              rows={byDay(d.eras)}
              rowKey={(day) => day.day}
              empty="DAC lists no era in this period."
              columns={[
                { label: 'Day', render: (day) => <b>{day.day}</b> },
                { label: 'Eras', render: (day) => eraLine(day) },
                {
                  label: 'Delivered',
                  align: 'right',
                  render: (day) => (day.consumed ? bytes(day.consumed.transferred_bytes) : '—'),
                },
                {
                  label: 'Stored',
                  align: 'right',
                  render: (day) => (day.consumed ? bytes(day.consumed.stored_bytes) : '—'),
                },
                {
                  label: 'Reads · writes',
                  align: 'right',
                  render: (day) =>
                    day.consumed ? `${compact(day.consumed.gets)} · ${compact(day.consumed.puts)}` : '—',
                },
                {
                  label: 'CPU units',
                  align: 'right',
                  render: (day) => (day.consumed ? compact(day.consumed.cpu_units) : '—'),
                },
                {
                  label: 'GPU units',
                  align: 'right',
                  render: (day) => (day.consumed ? compact(day.consumed.gpu_units) : '—'),
                },
                { label: 'Recorded', align: 'right', render: (day) => `${day.withUsage} of ${day.eras.length}` },
              ]}
              detail={(day) => <EraList eras={day.eras} />}
            />
          </Panel>
        </Stack>
      )}
    </>
  );
}

function eraLine(d: Day): string {
  const paid = d.statuses.ERA_PAID ?? 0;
  const open = d.statuses.ERA_IN_PROGRESS ?? 0;
  return `${paid} paid${open ? ` · ${open} in progress` : ''} of ${d.eras.length}`;
}

function EraList({ eras }: { eras: DACEra[] }) {
  const hm = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '4px 24px' }}>
      {eras.map((e) => (
        <Typography key={e.id} sx={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: color.textSecondary }}>
          <b style={{ color: color.text }}>
            {hm(e.start)}–{hm(e.end)}
          </b>{' '}
          {e.status === 'ERA_PAID'
            ? 'paid'
            : e.status === 'ERA_IN_PROGRESS'
              ? 'in progress'
              : e.status.replace('ERA_', '').toLowerCase()}
          {e.consumed ? ` · ${bytes(e.consumed.transferred_bytes)}` : ' · not recorded'} · era {e.id}
        </Typography>
      ))}
    </Box>
  );
}
