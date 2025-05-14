import { FC, useState, useMemo } from 'react';
import { Box, Card, Typography, Stack } from '@cluster-apps/ui';
import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { EraDetail } from '@cluster-apps/api';

interface UsageByBucketProps {
  data: EraDetail[];
}

// Define colors for visualization
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#ff6b6b', '#00bcd4', '#9c27b0'];

// Convert raw data to chart-ready format
const processUsageData = (eras: EraDetail[]) => {
  if (!eras || eras.length === 0) {
    return [];
  }

  // In a real scenario, we would extract actual bucket data
  // For now, we'll use customer IDs as bucket identifiers
  const bucketMap = new Map<string, { storage: number; traffic: number }>();

  // Aggregate data across all eras
  eras.forEach((era) => {
    if (era.customers) {
      Object.entries(era.customers).forEach(([customerId, usage]) => {
        if (!bucketMap.has(customerId)) {
          bucketMap.set(customerId, { storage: 0, traffic: 0 });
        }

        const current = bucketMap.get(customerId)!;

        // Gets + puts = storage, transferredBytes = traffic
        const storage = (usage.gets || 0) + (usage.puts || 0);
        const traffic = usage.transferredBytes || 0;

        bucketMap.set(customerId, {
          storage: current.storage + storage,
          traffic: current.traffic + traffic,
        });
      });
    }
  });

  // Convert to chart data format and convert bytes to GB for display
  return Array.from(bucketMap.entries()).map(([bucketId, usage], index) => {
    return {
      name: bucketId.substring(0, 8), // Truncate ID for display
      Storage: Math.round((usage.storage / (1024 * 1024 * 1024)) * 100) / 100, // Convert to GB
      Traffic: Math.round((usage.traffic / (1024 * 1024 * 1024)) * 100) / 100, // Convert to GB
      color: COLORS[index % COLORS.length],
    };
  });
};

const UsageByBucket: FC<UsageByBucketProps> = ({ data }) => {
  const [bucketFilter, setBucketFilter] = useState('all');

  const handleBucketChange = (event: SelectChangeEvent) => {
    setBucketFilter(event.target.value);
  };

  const bucketData = useMemo(() => processUsageData(data), [data]);

  // Filter data based on selected bucket
  const filteredData = useMemo(() => {
    if (bucketFilter === 'all') {
      return bucketData;
    }
    return bucketData.filter((item) => item.name === bucketFilter);
  }, [bucketData, bucketFilter]);

  return (
    <Card sx={{ p: 3, mb: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1">Usage by Bucket</Typography>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel id="bucket-filter-label">Bucket: All</InputLabel>
          <Select
            labelId="bucket-filter-label"
            value={bucketFilter}
            label="Bucket: All"
            onChange={handleBucketChange}
            size="small"
          >
            <MenuItem value="all">All</MenuItem>
            {bucketData.map((bucket) => (
              <MenuItem key={bucket.name} value={bucket.name}>
                {bucket.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {filteredData.length > 0 ? (
        <Box sx={{ height: 300, pt: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: 'GB', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value: number) => [`${value} GB`, undefined]} />
              <Legend />
              <Bar dataKey="Storage" fill="#8884d8" name="Storage" />
              <Bar dataKey="Traffic" fill="#82ca9d" name="Traffic" />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '300px',
          }}
        >
          <Typography variant="body1" color="text.secondary">
            No usage data available
          </Typography>
        </Box>
      )}
    </Card>
  );
};

export default observer(UsageByBucket);
