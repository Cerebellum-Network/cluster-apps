import { TextField, MenuItem } from '@cluster-apps/ui';
import { EraRangePreset, ERA_RANGE_LABELS } from '@cluster-apps/api';

interface EraRangeSelectorProps {
  value: EraRangePreset;
  onChange: (preset: EraRangePreset) => void;
}

const presetOptions = Object.entries(ERA_RANGE_LABELS) as [EraRangePreset, string][];

export const EraRangeSelector = ({ value, onChange }: EraRangeSelectorProps) => (
  <TextField
    select
    size="small"
    value={value}
    onChange={(e) => onChange(e.target.value as EraRangePreset)}
    sx={{ minWidth: 160 }}
  >
    {presetOptions.map(([key, label]) => (
      <MenuItem key={key} value={key}>
        {label}
      </MenuItem>
    ))}
  </TextField>
);
