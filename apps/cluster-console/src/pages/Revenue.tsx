import { Box, Stack, Typography } from '@cluster-apps/ui';
import { Button, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';

import type { DACEra, DACUsage, DACView } from '~/api/types';
import {
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
  Stat,
  type Tone,
} from '~/components/ui';
import { useFilters } from '~/components/Filters';
import { bytes, num, shortKey, time } from '~/format';
import { useView } from '~/hooks/useView';

import { byDay, eraStatus, type Day } from './dac';

const STATUS_TONE: Record<string, Tone> = {
  ERA_PAID: 'success',
  ERA_IN_PROGRESS: 'primary',
  ERA_PROCESSED: 'neutral',
  ERA_INSPECTED: 'neutral',
  ERA_EMPTY: 'neutral',
  ERA_FORCED_SKIPPED: 'warning',
};

const NO_SOURCE = (
  <Tooltip title="Payout receipts on the blockchain (DdcPayouts) and the CERE rate: not read by this console backend.">
    <span style={{ color: color.textTertiary }}>no source</span>
  </Tooltip>
);

/** Storage and delivery as one line: what was transferred and stored, and the requests. */
const storageLine = (u: DACUsage) =>
  `${bytes(u.transferred_bytes)} transferred · ${bytes(u.stored_bytes)} stored · ${num(u.gets, 0)} GET · ${num(u.puts, 0)} PUT`;

function Usage({ u, read, of }: { u: DACUsage | null; read: number; of: number }) {
  return u === null ? (
    <span style={{ color: color.textTertiary }}>not recorded</span>
  ) : (
    <Stack>
      <span>{storageLine(u)}</span>
      {read < of && (
        <Typography sx={{ fontSize: 11.5, color: color.textSecondary }}>
          {read} of {of} eras recorded
        </Typography>
      )}
    </Stack>
  );
}

const statusLine = (d: Day) =>
  Object.entries(d.statuses)
    .map(([k, n]) => `${n} ${eraStatus(k).toLowerCase()}`)
    .join(' · ');

/**
 * Revenue (canvas f1, Dragon 2 T28): per day, each era's payout status and
 * the usage DAC verified, by bill line. The money columns stay missing until
 * payout receipts are read.
 */
export function Revenue() {
  const f = useFilters(['hours']);
  const hours = f.values.hours === '168' ? 168 : 24;
  const v = useView<DACView>('/dac', { hours }, 60_000);
  const d = v.data;
  const days = d ? byDay(d.eras) : [];
  const read = d?.eras.filter((e) => e.consumed).length ?? 0;
  const paid = d?.eras.filter((e) => e.status === 'ERA_PAID').length ?? 0;
  const label = hours === 24 ? 'last 24 h' : 'last 7 days';

  return (
    <>
      <PageHeader
        title="Revenue"
        subtitle="What the cluster's work earns, per day: each era's payout status from DAC, and the usage DAC verified, by bill line. Days are UTC."
        actions={
          <>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={`${hours}`}
              onChange={(_, val) => val && f.set('hours', val === '24' ? '' : val)}
            >
              <ToggleButton value="24">24 h</ToggleButton>
              <ToggleButton value="168">7 days</ToggleButton>
            </ToggleButtonGroup>
            <Button size="small" variant="outlined" onClick={v.refresh} disabled={v.loading}>
              Refresh
            </Button>
          </>
        }
      />
      {v.error && !d && <Missing error={v.error} />}
      {!d && !v.error && <Loading />}
      {d && (
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 2 }}>
            <Stat
              label={`Eras, ${label}`}
              value={`${num(paid, 0)} paid of ${num(d.eras.length, 0)}${d.truncated ? '+' : ''}`}
              sub={`${num(read, 0)} with their usage recorded by this console`}
              source="DAC grouping collector · eras"
            />
            <Stat
              label={`Storage and delivery, ${label}`}
              value={bytes(d.consumed.transferred_bytes)}
              sub={`transferred · ${bytes(d.consumed.stored_bytes)} stored · ${num(d.consumed.gets, 0)} GET · ${num(d.consumed.puts, 0)} PUT`}
              source="DAC · customers' consumed usage, recorded eras"
            />
            <Stat
              label={`GPU, ${label}`}
              value={`${num(d.consumed.gpu_units, 0)} units`}
              sub="verified GPU units, recorded eras"
              source="DAC · customers' consumed usage, recorded eras"
            />
            <Stat
              label={`CPU and RAM, ${label}`}
              value={`${num(d.consumed.cpu_units, 0)} · ${num(d.consumed.ram_units, 0)}`}
              sub="verified CPU · RAM units, recorded eras; sandbox records are not collected yet (Sandboxes › Usage)"
              source="DAC · customers' consumed usage, recorded eras"
            />
          </Box>
          <Missing
            error={{
              source: 'payout receipts (DdcPayouts) and the cluster’s prices',
              detail:
                'Collected, your reserve and providers paid, in USD and CERE, come from the payout receipt of each era on the blockchain, and the split by bill line in money from verified usage × the cluster’s prices. This console backend reads neither yet, so those columns show “no source”.',
            }}
          />
          <Section flush>
            <RowsTable
              rows={days}
              rowKey={(day) => day.day}
              empty="DAC lists no era in this window."
              columns={[
                {
                  label: 'Day',
                  render: (day) => <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{day.day}</span>,
                },
                {
                  label: 'Eras',
                  render: (day) => (
                    <Stack>
                      <Mono>
                        {day.eras[day.eras.length - 1].id}–{day.eras[0].id}
                      </Mono>
                      <Typography sx={{ fontSize: 11.5, color: color.textSecondary }}>
                        {day.eras.length} eras
                      </Typography>
                    </Stack>
                  ),
                },
                { label: 'Payout', render: (day) => statusLine(day) },
                { label: 'Collected', align: 'right', render: () => NO_SOURCE },
                {
                  label: 'Storage and delivery',
                  render: (day) => <Usage u={day.consumed} read={day.withUsage} of={day.eras.length} />,
                },
                {
                  label: 'GPU',
                  align: 'right',
                  render: (day) => (day.consumed ? `${num(day.consumed.gpu_units, 0)} units` : '—'),
                },
                {
                  label: 'CPU and RAM',
                  align: 'right',
                  render: (day) =>
                    day.consumed ? `${num(day.consumed.cpu_units, 0)} · ${num(day.consumed.ram_units, 0)} units` : '—',
                },
                { label: 'Your reserve', align: 'right', render: () => NO_SOURCE },
                { label: 'Providers paid', align: 'right', render: () => NO_SOURCE },
              ]}
              detail={(day) => <EraTable eras={day.eras} />}
            />
          </Section>
          <Section title="Where these numbers come from">
            <Facts
              items={[
                [
                  'DAC grouping collector',
                  <span key="c">
                    <Mono title={d.collector.key}>{shortKey(d.collector.key, 8, 6)}</Mono> at{' '}
                    <Mono>{d.collector.url}</Mono>,{' '}
                    {d.collector.from === 'blockchain'
                      ? 'found on the blockchain (a storage node names it; its host and port are on its node record)'
                      : 'set in the console backend config'}
                    ; every page carries its signature
                  </span>,
                ],
                ['Eras', 'GET /activity/v1/eras: status, customers and providers of each era'],
                [
                  'Usage',
                  'GET /activity/v1/ehds/traverse/{era}: the sealed era document payouts charge from; the customers’ consumed usage is summed here',
                ],
                [
                  'Recorded since',
                  `${time(d.kept_since)}. The collector serves an era’s document only for its last few eras, so the console backend records each one while it is served; earlier eras show “not recorded”.`,
                ],
              ]}
            />
          </Section>
          <SourceLine>Read {time(d.read_at)}. Every number and its source: “What backs each number”.</SourceLine>
        </Stack>
      )}
    </>
  );
}

function EraTable({ eras }: { eras: DACEra[] }) {
  return (
    <Stack spacing={0.5}>
      {eras.map((e) => (
        <Stack key={e.id} direction="row" spacing={1.5} alignItems="center" sx={{ fontSize: 12.5 }}>
          <Mono>{e.id}</Mono>
          <span style={{ whiteSpace: 'nowrap', minWidth: 210 }}>
            {time(e.start)} – {time(e.end).replace(/^.*, /, '')}
          </span>
          <Box sx={{ minWidth: 96 }}>
            <Pill tone={STATUS_TONE[e.status] ?? 'neutral'}>{eraStatus(e.status)}</Pill>
          </Box>
          <span style={{ whiteSpace: 'nowrap', color: color.textSecondary }}>
            {e.customers} customers · {e.providers} providers
          </span>
          <Box minWidth={0}>
            {e.consumed ? (
              <span>
                {storageLine(e.consumed)} · GPU {num(e.consumed.gpu_units, 0)} · CPU {num(e.consumed.cpu_units, 0)} ·
                RAM {num(e.consumed.ram_units, 0)}
              </span>
            ) : (
              <Tooltip title={e.missing?.detail ?? ''}>
                <span style={{ color: color.textTertiary }}>
                  {e.status === 'ERA_IN_PROGRESS' ? 'era in progress' : 'not recorded'}
                </span>
              </Tooltip>
            )}
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}
