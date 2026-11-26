import { Box, Stack, Typography } from '@cluster-apps/ui';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';

import type { UsageView } from '~/api/types';
import { RankedBars } from '~/components/charts';
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
  text,
} from '~/components/ui';
import { ago, gibHours, num, percent, vcpuHours } from '~/format';
import { useView } from '~/hooks/useView';

/**
 * Customers (canvas e1, Dragon 2 T27): who uses the cluster and how much.
 * Today's source is the sandbox service's usage records, per customer bucket;
 * storage, delivery and inference per customer and deposits are said to be
 * missing, not guessed.
 */
export function Customers() {
  const f = useFilters(['hours']);
  const hours = f.values.hours === '168' ? 168 : 24;
  const v = useView<UsageView>('/usage', { hours }, 60_000);
  const d = v.data;
  const period = hours === 24 ? 'last 24 h' : 'last 7 days';
  const total = d?.totals.billed_cpu_s ?? 0;
  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Customer buckets that used the cluster’s sandboxes, by what they were billed."
        updatedAt={v.updatedAt}
        onRefresh={v.refresh}
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
      {v.error && !d && <CouldNotRead error={v.error} what="usage" />}
      {!d && !v.error && <Loading />}
      {d && (
        <Stack spacing={2}>
          <Figures columns={3}>
            <Figure
              label={`Customer buckets, ${period}`}
              value={num(d.by_bucket.length, 0)}
              sub={`ran ${num(d.sandboxes, 0)} sandboxes`}
            />
            <Figure
              label={`Billed, ${period}`}
              value={vcpuHours(d.totals.billed_cpu_s)}
              sub={gibHours(d.totals.billed_ram_gib_s)}
            />
            <Figure
              label="Largest customer"
              value={d.by_bucket[0] ? `Bucket ${d.by_bucket[0].bucket}` : '—'}
              sub={
                d.by_bucket[0]
                  ? `${percent(d.by_bucket[0].billed_cpu_s, total)} of billed vCPU-hours`
                  : 'No usage in this period.'
              }
            />
          </Figures>
          <Box
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 2fr)' }, gap: 2 }}
          >
            <Panel title="Share of billed vCPU-hours">
              <RankedBars
                rows={d.by_bucket.slice(0, 8).map((b) => ({
                  key: `${b.bucket}`,
                  label: `Bucket ${b.bucket}`,
                  value: b.billed_cpu_s,
                  display: vcpuHours(b.billed_cpu_s),
                  title: `Bucket ${b.bucket}: ${vcpuHours(b.billed_cpu_s)} billed`,
                }))}
                empty="No customer used sandboxes in this period."
              />
            </Panel>
            <Panel flush title="Every customer bucket">
              <RowsTable
                rows={d.by_bucket}
                rowKey={(b) => `${b.bucket}`}
                empty="No customer used sandboxes in this period."
                columns={[
                  { label: 'Bucket', render: (b) => <b>{b.bucket}</b> },
                  { label: 'Sandboxes', align: 'right', render: (b) => num(b.sandboxes, 0) },
                  {
                    label: 'Billed vCPU-h',
                    align: 'right',
                    render: (b) => vcpuHours(b.billed_cpu_s).replace(' vCPU-h', ''),
                  },
                  {
                    label: 'Billed GiB-h',
                    align: 'right',
                    render: (b) => gibHours(b.billed_ram_gib_s).replace(' GiB-h', ''),
                  },
                  {
                    label: 'Measured vCPU-h',
                    align: 'right',
                    render: (b) => vcpuHours(b.cpu_s).replace(' vCPU-h', ''),
                  },
                  { label: 'Share', align: 'right', render: (b) => percent(b.billed_cpu_s, total) },
                  { label: 'Last active', render: (b) => ago(b.last_active) },
                ]}
              />
            </Panel>
          </Box>
          <Box>
            <NotYet why="Storage and delivery per customer come from DAC's era reports per customer; inference from the gateway's per-bucket metrics; deposits from the cluster's deposit contract. The console backend reads none of them per customer yet.">
              storage, delivery and inference per customer, and deposits.
            </NotYet>
            <Typography sx={{ ...text.caption, color: color.textTertiary, marginTop: 0.5 }}>
              A bucket belongs to one account; the account behind each bucket is on the blockchain.
            </Typography>
          </Box>
        </Stack>
      )}
    </>
  );
}
