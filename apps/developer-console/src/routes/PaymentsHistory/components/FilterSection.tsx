import { FC } from 'react';
import { Box, Stack, Button } from '@cluster-apps/ui';
import { MenuItem, SelectChangeEvent, FormControl, Select, InputLabel, Chip, OutlinedInput } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { PaymentsHistoryStore } from '../../../stores/PaymentsStore/PaymentsStore.ts';

interface FilterSectionProps {
  store: PaymentsHistoryStore;
}

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

const periods = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'last_year', label: 'Last year' },
];

const FilterSection: FC<FilterSectionProps> = ({ store }) => {
  const handleEraChange = (event: SelectChangeEvent<string>) => {
    store.setTempEra(parseInt(event.target.value));
  };

  const handlePeriodChange = (event: SelectChangeEvent<string>) => {
    store.setTempPeriod(event.target.value);
  };

  const handleBucketChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    store.setTempBuckets(typeof value === 'string' ? [value] : value);
  };

  const applyFilters = () => {
    store.applyFilters();
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        {/* Bucket Selection (Multiple) */}
        <FormControl sx={{ minWidth: 180, flex: 1 }}>
          <InputLabel id="bucket-select-label">Bucket</InputLabel>
          <Select
            labelId="bucket-select-label"
            multiple
            value={store.tempSelectedBucketIds}
            onChange={handleBucketChange}
            input={<OutlinedInput label="Bucket" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((bucketId) => (
                  <Chip key={bucketId} label={`ID: ${bucketId.substring(0, 8)}`} size="small" />
                ))}
              </Box>
            )}
            MenuProps={MenuProps}
          >
            {store.buckets.map((bucket) => (
              <MenuItem key={bucket.id.toString()} value={bucket.id.toString()}>
                ID: {bucket.id.toString()}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Era Selection (filtered based on buckets) */}
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="era-select-label">Era</InputLabel>
          <Select
            labelId="era-select-label"
            value={store.tempSelectedEraId?.toString() || ''}
            label="Era"
            onChange={handleEraChange}
            disabled={store.filteredEras.length === 0}
          >
            {store.filteredEras.map((eraId) => (
              <MenuItem key={eraId} value={eraId.toString()}>
                ID: {eraId}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Period Selection */}
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="period-select-label">Period</InputLabel>
          <Select
            labelId="period-select-label"
            value={store.tempSelectedPeriod}
            label="Period"
            onChange={handlePeriodChange}
          >
            {periods.map((period) => (
              <MenuItem key={period.value} value={period.value}>
                {period.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button variant="contained" color="primary" onClick={applyFilters}>
          Apply Filters
        </Button>
      </Stack>
    </Box>
  );
};

export default observer(FilterSection);
