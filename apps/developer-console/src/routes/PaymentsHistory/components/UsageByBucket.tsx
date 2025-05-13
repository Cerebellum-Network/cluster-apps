import { FC, useState } from 'react';
import { Box, Card, Typography, Stack } from '@cluster-apps/ui';
import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { EraDetail } from '@cluster-apps/api';

interface UsageByBucketProps {
  data: EraDetail[];
}

// Mock buckets data
const BUCKET_TYPES = [
  { id: 'user-uploads', name: 'user-uploads', color: '#8884d8' },
  { id: 'assets', name: 'assets', color: '#82ca9d' },
  { id: 'backups', name: 'backups', color: '#ffc658' },
  { id: 'media', name: 'media', color: '#ff8042' },
  { id: 'static', name: 'static', color: '#0088fe' },
];

// Generate mock data for buckets
const generateBucketData = (eras: EraDetail[]) => {
  // Use the sum of all eras for a realistic total value
  const totalValue = eras.reduce((sum, era) => sum + era.total_puts_value + era.total_gets_value, 0);

  return BUCKET_TYPES.map((type) => {
    // Random distribution of storage and traffic between buckets
    const multiplier = Math.random() * 0.8 + 0.2; // Between 0.2 and 1.0
    const value = (totalValue * multiplier) / BUCKET_TYPES.length;

    // Split the value between storage and traffic
    const storageRatio = Math.random() * 0.7 + 0.3; // Between 0.3 and 1.0

    return {
      name: type.id,
      Storage: Math.floor((value * storageRatio) / 1000000), // Convert to MB for display
      Traffic: Math.floor((value * (1 - storageRatio)) / 1000000), // Convert to MB for display
    };
  });
};

const UsageByBucket: FC<UsageByBucketProps> = ({ data }) => {
  const [bucketFilter, setBucketFilter] = useState('all');

  const handleBucketChange = (event: SelectChangeEvent) => {
    setBucketFilter(event.target.value);
  };

  const bucketData = generateBucketData(data);

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
            {BUCKET_TYPES.map((bucket) => (
              <MenuItem key={bucket.id} value={bucket.id}>
                {bucket.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Box sx={{ height: 300, pt: 2 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bucketData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
    </Card>
  );
};

export default observer(UsageByBucket);
