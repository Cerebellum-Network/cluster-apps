import { MenuItem, TextField } from '@mui/material';

export type MetricsPeriod = 'hour' | 'day' | 'week' | 'month';

export type PeriodSelectProps = {
  value?: MetricsPeriod;
  onChange?: (value: MetricsPeriod) => void;
};

type Option = {
  value: MetricsPeriod;
  label: string;
};

const options: Option[] = [
  /**
   * TODO: Enable the options below when the backend supports them
   */
  // { value: 'hour', label: 'Last hour' },
  // { value: 'day', label: '24 hours' },
  { value: 'week', label: '1 week' },
  { value: 'month', label: '1 month' },
];

export const PeriodSelect = ({ value, onChange }: PeriodSelectProps) => (
  <TextField
    select
    size="small"
    value={value}
    defaultValue={options[0].value}
    onChange={(e) => onChange?.(e.target.value as MetricsPeriod)}
  >
    {options.map(({ value, label }) => (
      <MenuItem key={value} value={value}>
        {label}
      </MenuItem>
    ))}
  </TextField>
);
