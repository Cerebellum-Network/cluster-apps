import { TextField, MenuItem } from '@cluster-apps/ui';
import { ProviderMetricKey, PROVIDER_METRIC_LABELS } from '@cluster-apps/api';

interface MetricSelectorProps {
  value: ProviderMetricKey;
  onChange: (key: ProviderMetricKey) => void;
}

const metricOptions = (Object.entries(PROVIDER_METRIC_LABELS) as [ProviderMetricKey, string][]).filter(
  ([key]) => key !== 'reward',
);

export const MetricSelector = ({ value, onChange }: MetricSelectorProps) => (
  <TextField
    select
    size="small"
    value={value}
    onChange={(e) => onChange(e.target.value as ProviderMetricKey)}
    sx={{ minWidth: 200 }}
  >
    {metricOptions.map(([key, label]) => (
      <MenuItem key={key} value={key}>
        {label}
      </MenuItem>
    ))}
  </TextField>
);
