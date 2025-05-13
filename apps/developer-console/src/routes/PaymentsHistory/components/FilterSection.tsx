import { FC } from 'react';
import { Box, Stack, Button } from '@cluster-apps/ui';
import { MenuItem, SelectChangeEvent, FormControl, Select, InputLabel } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { PaymentsHistoryStore } from '../store';

interface FilterSectionProps {
  store: PaymentsHistoryStore;
}

const periods = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'last_year', label: 'Last year' },
];

const FilterSection: FC<FilterSectionProps> = ({ store }) => {
  const handleClusterChange = (event: SelectChangeEvent<string>) => {
    store.setSelectedCluster(event.target.value);
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="era-select-label">Era</InputLabel>
          <Select
            labelId="era-select-label"
            value={store.selectedClusterId || ''}
            label="Era"
            onChange={handleClusterChange}
          >
            {store.clusters.map((clusterId) => (
              <MenuItem key={clusterId} value={clusterId}>
                ID: {clusterId}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="period-select-label">Period</InputLabel>
          <Select labelId="period-select-label" value="this_month" label="Period">
            {periods.map((period) => (
              <MenuItem key={period.value} value={period.value}>
                {period.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="bucket-select-label">Bucket</InputLabel>
          <Select labelId="bucket-select-label" value="" label="Bucket">
            <MenuItem value="">ID: {store.selectedClusterId || ''}</MenuItem>
          </Select>
        </FormControl>

        <Button variant="contained" color="primary">
          Apply Filters
        </Button>
      </Stack>
    </Box>
  );
};

export default observer(FilterSection);
