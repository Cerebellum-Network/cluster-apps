import { TextField, MenuItem } from '@cluster-apps/ui';
import { MetricKey, METRIC_LABELS } from '@cluster-apps/api';

interface MetricSelectorProps {
  value: MetricKey;
  onChange: (key: MetricKey) => void;
}

const metricOptions = (Object.entries(METRIC_LABELS) as [MetricKey, string][]).filter(([key]) => key !== 'charge');

export const MetricSelector = ({ value, onChange }: MetricSelectorProps) => (
  <TextField
    select
    size="small"
    value={value}
    onChange={(e) => onChange(e.target.value as MetricKey)}
    sx={{ minWidth: 200 }}
  >
    {metricOptions.map(([key, label]) => (
      <MenuItem key={key} value={key}>
        {label}
      </MenuItem>
    ))}
  </TextField>
);
