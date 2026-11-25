import { ReactNode, useId, useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@cluster-apps/ui';
import { Collapse } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import {
  defaultMemoryLimit,
  MAX_CPU_LIMIT,
  parseResources,
  plannedCpu,
  plannedMemory,
  type ResourceDefaults,
  type ResourceErrors,
  type ResourceFields,
} from '~/compute/resources';
import { color, text } from '~/theme/tokens';

/**
 * CPU and memory for a sandbox or an agent's runs: the request (guaranteed,
 * and the least it is billed) in the open, the limits (the most it can use)
 * behind "Limits". Under them, what the sandbox will get in a sentence, with
 * the defaults filled in. `defaults` is the request an empty field gets;
 * `extra` sits in the request row (an agent's time limit).
 */
const ResourceInputs = ({
  value,
  onChange,
  defaults,
  errors,
  extra,
}: {
  value: ResourceFields;
  onChange: (patch: Partial<ResourceFields>) => void;
  defaults: ResourceDefaults;
  /** Shown under their fields; pass only the ones to show now. */
  errors: ResourceErrors;
  extra?: ReactNode;
}) => {
  const [open, setOpen] = useState(() => !!(value.cpuLimit || value.memoryLimitMib));
  const limitsId = useId();
  // The sentence reads what will apply: a field with a problem counts as its default until fixed.
  const { effective } = parseResources(
    {
      cpu: errors.cpu ? '' : value.cpu,
      memoryMib: errors.memoryMib ? '' : value.memoryMib,
      cpuLimit: errors.cpuLimit ? '' : value.cpuLimit,
      memoryLimitMib: errors.memoryLimitMib ? '' : value.memoryLimitMib,
    },
    defaults,
  );
  const limitSet = !!(value.cpuLimit.trim() || value.memoryLimitMib.trim());
  const shrink = { shrink: true };

  return (
    <Stack spacing="12px">
      <Stack direction={{ xs: 'column', md: 'row' }} gap="16px">
        <TextField
          label="CPU request (vCPU)"
          value={value.cpu}
          onChange={(e) => onChange({ cpu: e.target.value })}
          placeholder={String(defaults.cpu)}
          size="small"
          fullWidth
          error={!!errors.cpu}
          helperText={errors.cpu ?? 'Guaranteed to it; billed for as long as it runs.'}
          InputLabelProps={shrink}
          inputProps={{ inputMode: 'decimal' }}
        />
        <TextField
          label="Memory request (MiB)"
          value={value.memoryMib}
          onChange={(e) => onChange({ memoryMib: e.target.value })}
          placeholder={String(defaults.memoryMib)}
          size="small"
          fullWidth
          error={!!errors.memoryMib}
          helperText={errors.memoryMib ?? 'Guaranteed: never taken back while it runs.'}
          InputLabelProps={shrink}
          inputProps={{ inputMode: 'numeric' }}
        />
        {extra}
      </Stack>

      <Box
        sx={{
          border: `1px solid ${color.border}`,
          borderRadius: '12px',
          backgroundColor: color.inset,
          padding: '10px 14px',
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap="12px">
          <Box minWidth={0} aria-live="polite">
            <Typography sx={{ fontSize: 13.5, lineHeight: '20px', fontWeight: 600, color: color.text }}>
              {plannedCpu(effective)}
            </Typography>
            <Typography sx={{ fontSize: 13.5, lineHeight: '20px', fontWeight: 600, color: color.text }}>
              {plannedMemory(effective)}
            </Typography>
            <Typography sx={{ ...text.caption, marginTop: '4px' }}>
              You pay for the request for as long as it runs, and for use above it (a burst) as it happens.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="text"
            color="secondary"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={limitsId}
            endIcon={
              <ExpandMoreIcon
                sx={{
                  transform: open ? 'rotate(180deg)' : 'none',
                  transition: 'transform 150ms ease',
                  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                }}
              />
            }
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {limitSet && !open ? 'Limits set' : 'Limits'}
          </Button>
        </Stack>
        <Collapse in={open} id={limitsId}>
          <Stack direction={{ xs: 'column', md: 'row' }} gap="16px" sx={{ paddingTop: '14px' }}>
            <TextField
              label="CPU limit (vCPU)"
              value={value.cpuLimit}
              onChange={(e) => onChange({ cpuLimit: e.target.value })}
              placeholder={
                defaults.cpuLimit
                  ? String(Math.max(defaults.cpuLimit, effective.cpu))
                  : `node’s quota, max ${MAX_CPU_LIMIT}`
              }
              size="small"
              fullWidth
              error={!!errors.cpuLimit}
              helperText={errors.cpuLimit ?? 'The most it can use; at least the request.'}
              InputLabelProps={shrink}
              inputProps={{ inputMode: 'decimal' }}
            />
            <TextField
              label="Memory limit (MiB)"
              value={value.memoryLimitMib}
              onChange={(e) => onChange({ memoryLimitMib: e.target.value })}
              placeholder={String(
                defaults.memoryLimitMib
                  ? Math.max(defaults.memoryLimitMib, effective.memoryMib)
                  : defaultMemoryLimit(effective.memoryMib),
              )}
              size="small"
              fullWidth
              error={!!errors.memoryLimitMib}
              helperText={errors.memoryLimitMib ?? 'Above it, it stops (out of memory).'}
              InputLabelProps={shrink}
              inputProps={{ inputMode: 'numeric' }}
            />
          </Stack>
        </Collapse>
      </Box>
    </Stack>
  );
};

export default ResourceInputs;
