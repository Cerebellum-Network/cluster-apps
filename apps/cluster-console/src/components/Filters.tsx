import { MenuItem, TextField } from '@mui/material';
import { useSearchParams } from 'react-router-dom';

/** Filters live in the URL, so a link from the overview opens the filtered list. */
export function useFilters(keys: string[]) {
  const [sp, setSp] = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, sp.get(k) ?? ''])) as Record<string, string>;
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v);
    else next.delete(k);
    setSp(next, { replace: true });
  };
  return { values, set };
}

export function SelectFilter({
  label,
  value,
  options,
  onChange,
  width = 150,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  width?: number;
}) {
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ width }}
    >
      <MenuItem value="">All</MenuItem>
      {options.map(([v, l]) => (
        <MenuItem key={v} value={v}>
          {l}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function TextFilter({
  label,
  value,
  onChange,
  width = 170,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  width?: number;
}) {
  return (
    <TextField
      size="small"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value.trim())}
      sx={{ width }}
    />
  );
}
