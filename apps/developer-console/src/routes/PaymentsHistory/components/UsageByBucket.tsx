import { FC, useMemo } from 'react';
import { Box, Card, Typography, Stack } from '@cluster-apps/ui';
import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Chip, OutlinedInput } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import { EraDetail, IndexedBucket } from '@cluster-apps/api';
import { usePaymentHistoryStore } from '~/hooks';

interface UsageByBucketProps {
  data: EraDetail[];
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#ff6b6b', '#00bcd4', '#9c27b0'];

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const generateEmptyBucketData = (buckets: IndexedBucket[]) => {
  if (!buckets?.length) return [];
  return buckets.slice(0, 5).map((bucket, index) => {
    const idStr = bucket.id.toString();
    return {
      id: idStr,
      name: `ID: ${idStr.slice(0, 8)}`,
      Storage: 0,
      Traffic: 0,
      Cost: 0,
      color: COLORS[index % COLORS.length],
    };
  });
};

const processUsageData = (eras: EraDetail[], buckets: IndexedBucket[], selectedBucketIds: string[]) => {
  if (!eras?.length || !buckets?.length) return generateEmptyBucketData(buckets);

  const era = eras[0];
  const filteredBuckets =
    selectedBucketIds.length > 0 ? buckets.filter((b) => selectedBucketIds.includes(b.id.toString())) : buckets;

  const bucketMap = new Map<string, { storage: number; traffic: number; cost: number; name: string }>();
  filteredBuckets.forEach((b) => {
    const id = b.id.toString();
    bucketMap.set(id, { storage: 0, traffic: 0, cost: 0, name: `ID: ${id.slice(0, 8)}` });
  });

  if (era.buckets) {
    Object.entries(era.buckets).forEach(([bucketId, usage]) => {
      if (!bucketMap.has(bucketId)) return;

      const prev = bucketMap.get(bucketId)!;
      const storage = (usage.gets || 0) + (usage.puts || 0);
      const traffic = usage.transferredBytes || 0;
      let cost = 0;
      if (era.token_estimates?.bucket_estimates?.[bucketId]) {
        cost = era.token_estimates.bucket_estimates[bucketId].total_value || 0;
      }

      bucketMap.set(bucketId, {
        storage,
        traffic,
        cost,
        name: prev.name,
      });
    });
  }

  return Array.from(bucketMap.entries()).map(([id, usage], index) => ({
    id,
    name: usage.name,
    Storage: usage.storage,
    Traffic: Math.round((usage.traffic / (1024 * 1024)) * 100) / 100,
    Cost: Math.round(usage.cost / 10000) / 100,
    color: COLORS[index % COLORS.length],
  }));
};

const UsageByBucket: FC<UsageByBucketProps> = ({ data }) => {
  const store = usePaymentHistoryStore();

  const handleBucketChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    // Use main store filters to maintain consistency
    store.setTempBuckets(typeof value === 'string' ? [value] : value);
    // Apply filters immediately for this chart
    store.applyFilters();
  };

  // Get bucket data based on selected buckets in the store
  const bucketData = useMemo(
    () => processUsageData(data, store.buckets, store.selectedBucketIds),
    [data, store.buckets, store.selectedBucketIds],
  );

  const isEmpty = data.length === 0 || bucketData.length === 0;

  return (
    <Card sx={{ p: 3, mb: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" color={isEmpty ? 'text.disabled' : 'text.primary'}>
          Usage by Bucket{isEmpty && ' (No data for selected filters)'}
        </Typography>

        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel id="bucket-filter-label">Buckets</InputLabel>
          <Select
            labelId="bucket-filter-label"
            multiple
            value={store.selectedBucketIds}
            onChange={handleBucketChange}
            input={<OutlinedInput label="Buckets" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.length > 0 ? (
                  selected.map((val) => <Chip key={val} label={`ID: ${val.slice(0, 8)}`} size="small" />)
                ) : (
                  <Chip label="All" size="small" />
                )}
              </Box>
            )}
            MenuProps={MenuProps}
            size="small"
            disabled={isEmpty}
          >
            {store.buckets.map((bucket) => (
              <MenuItem key={bucket.id.toString()} value={bucket.id.toString()}>
                ID: {bucket.id.toString().slice(0, 8)}...
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Box sx={{ height: 300, pt: 2 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bucketData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={isEmpty ? 0.5 : 1} />
            <XAxis dataKey="name" opacity={isEmpty ? 0.5 : 1} />
            <YAxis label={{ value: 'Units', angle: -90, position: 'insideLeft' }} opacity={isEmpty ? 0.5 : 1} />
            <Tooltip
              formatter={(value: number, name: string) => {
                switch (name) {
                  case 'Storage':
                    return [`${value} ops`, name];
                  case 'Traffic':
                    return [`${value} MB`, name];
                  case 'Cost':
                    return [`$${value}`, name];
                  default:
                    return [value, name];
                }
              }}
            />
            <Legend />
            <Bar dataKey="Storage" fill="#8884d8" name="Storage" fillOpacity={isEmpty ? 0.3 : 1} />
            <Bar dataKey="Traffic" fill="#82ca9d" name="Traffic" fillOpacity={isEmpty ? 0.3 : 1} />
            <Bar dataKey="Cost" fill="#ff8042" name="Cost" fillOpacity={isEmpty ? 0.3 : 1} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Card>
  );
};

export default observer(UsageByBucket);
