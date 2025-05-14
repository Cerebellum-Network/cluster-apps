import { FC, useState, useMemo } from 'react';
import { Box, Card, Typography, Stack } from '@cluster-apps/ui';
import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { EraDetail, IndexedBucket } from '@cluster-apps/api';
import { usePaymentHistoryStore } from '~/hooks';

interface UsageByBucketProps {
  data: EraDetail[];
}

// Define colors for visualization
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#ff6b6b', '#00bcd4', '#9c27b0'];

// Generate empty data for buckets when no real data
const generateEmptyBucketData = (buckets: IndexedBucket[]) => {
  if (!buckets || buckets.length === 0) {
    return [];
  }

  return buckets.slice(0, 5).map((bucket, index) => {
    const bucketId = bucket.id.toString();
    return {
      id: bucketId,
      name: `ID: ${bucketId.substring(0, 8)}`,
      Storage: 0,
      Traffic: 0,
      color: COLORS[index % COLORS.length],
    };
  });
};

// Convert raw data to chart-ready format
const processUsageData = (eras: EraDetail[], buckets: IndexedBucket[]) => {
  if (!eras || eras.length === 0) {
    return generateEmptyBucketData(buckets);
  }

  if (!buckets || buckets.length === 0) {
    return [];
  }

  // Use actual buckets for data
  const bucketMap = new Map<string, { storage: number; traffic: number; name: string }>();

  // Initialize map with bucket IDs
  buckets.forEach((bucket) => {
    const bucketId = bucket.id.toString();
    bucketMap.set(bucketId, {
      storage: 0,
      traffic: 0,
      name: `ID: ${bucketId.substring(0, 8)}`, // Truncate for display
    });
  });

  // Aggregate data across all eras
  eras.forEach((era) => {
    if (era.customers) {
      Object.entries(era.customers).forEach(([customerId, usage]) => {
        // Skip if not a tracked bucket
        if (!bucketMap.has(customerId)) return;

        const current = bucketMap.get(customerId)!;

        // Gets + puts = storage, transferredBytes = traffic
        const storage = (usage.gets || 0) + (usage.puts || 0);
        const traffic = usage.transferredBytes || 0;

        bucketMap.set(customerId, {
          ...current,
          storage: current.storage + storage,
          traffic: current.traffic + traffic,
        });
      });
    }
  });

  // Convert to chart data format and convert bytes to GB for display
  return Array.from(bucketMap.entries()).map(([bucketId, usage], index) => {
    return {
      id: bucketId,
      name: usage.name,
      Storage: Math.round((usage.storage / (1024 * 1024 * 1024)) * 100) / 100, // Convert to GB
      Traffic: Math.round((usage.traffic / (1024 * 1024 * 1024)) * 100) / 100, // Convert to GB
      color: COLORS[index % COLORS.length],
    };
  });
};

const UsageByBucket: FC<UsageByBucketProps> = ({ data }) => {
  const store = usePaymentHistoryStore();
  const [bucketFilter, setBucketFilter] = useState('all');

  const handleBucketChange = (event: SelectChangeEvent) => {
    setBucketFilter(event.target.value);
  };

  const bucketData = useMemo(() => processUsageData(data, store.buckets), [data, store.buckets]);

  // Filter data based on selected bucket
  const filteredData = useMemo(() => {
    if (bucketFilter === 'all') {
      return bucketData;
    }
    return bucketData.filter((item) => item.id === bucketFilter);
  }, [bucketData, bucketFilter]);

  const isEmpty = data.length === 0;

  return (
    <Card sx={{ p: 3, mb: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" color={isEmpty ? 'text.disabled' : 'text.primary'}>
          Usage by Bucket
          {isEmpty && ' (No data for selected filters)'}
        </Typography>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel id="bucket-filter-label">Bucket: All</InputLabel>
          <Select
            labelId="bucket-filter-label"
            value={bucketFilter}
            label="Bucket: All"
            onChange={handleBucketChange}
            size="small"
            disabled={isEmpty}
          >
            <MenuItem value="all">All</MenuItem>
            {bucketData.map((bucket) => (
              <MenuItem key={bucket.id} value={bucket.id}>
                {bucket.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Box sx={{ height: 300, pt: 2 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={isEmpty ? 0.5 : 1} />
            <XAxis dataKey="name" opacity={isEmpty ? 0.5 : 1} />
            <YAxis label={{ value: 'GB', angle: -90, position: 'insideLeft' }} opacity={isEmpty ? 0.5 : 1} />
            <Tooltip formatter={(value: number) => [`${value} GB`, undefined]} />
            <Legend />
            <Bar dataKey="Storage" fill="#8884d8" name="Storage" fillOpacity={isEmpty ? 0.3 : 1} />
            <Bar dataKey="Traffic" fill="#82ca9d" name="Traffic" fillOpacity={isEmpty ? 0.3 : 1} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Card>
  );
};

export default observer(UsageByBucket);
