import { Box, Button, IconButton, Stack, TextField, Typography } from '@cluster-apps/ui';
import { Checkbox, FormControlLabel } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { emptyOwnSecret, MAX_SANDBOX_SECRETS, type OwnSecretForm } from '~/compute/credentials';
import { color, mono, text } from '~/theme/tokens';

/**
 * A new sandbox's own credentials (`secrets` in the create body): each with
 * its name, the header it is sent as, the hosts it may go to, and its value in
 * a password field. The egress proxy holds them for this sandbox only and
 * drops them when it ends; rules name them like the bucket's, and they win
 * over a bucket credential of the same name. The values live only in this
 * form until the sandbox is created.
 */
const OwnSecretsEditor = ({
  value,
  onChange,
  errors,
  showErrors,
}: {
  value: OwnSecretForm[];
  onChange: (next: OwnSecretForm[]) => void;
  errors: (string | undefined)[];
  showErrors?: boolean;
}) => {
  const set = (i: number, patch: Partial<OwnSecretForm>) =>
    onChange(value.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <Stack gap="10px">
      {value.map((f, i) => {
        const error = errors[i] && (showErrors || (f.name && f.hosts && f.value)) ? errors[i] : undefined;
        const authorization = f.header.trim().toLowerCase() === 'authorization';
        return (
          <Box key={i} sx={{ border: `1px solid ${color.border}`, borderRadius: '12px', padding: '12px 14px' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} gap="10px" alignItems={{ md: 'flex-start' }}>
              <TextField
                placeholder="name"
                value={f.name}
                onChange={(e) => set(i, { name: e.target.value.toLowerCase() })}
                size="small"
                sx={{ flex: 0.9 }}
                inputProps={{ 'aria-label': 'Credential name', style: { fontFamily: mono, fontSize: 13 } }}
              />
              <TextField
                placeholder="Header"
                value={f.header}
                onChange={(e) => set(i, { header: e.target.value })}
                size="small"
                sx={{ flex: 0.8 }}
                inputProps={{ 'aria-label': 'Header', style: { fontFamily: mono, fontSize: 13 } }}
              />
              <TextField
                placeholder="api.example.com"
                value={f.hosts}
                onChange={(e) => set(i, { hosts: e.target.value })}
                size="small"
                sx={{ flex: 1.2 }}
                inputProps={{ 'aria-label': 'Sent only to', style: { fontFamily: mono, fontSize: 13 } }}
              />
              <TextField
                placeholder="Value"
                type="password"
                value={f.value}
                onChange={(e) => set(i, { value: e.target.value })}
                size="small"
                autoComplete="new-password"
                sx={{ flex: 1.1 }}
                inputProps={{ 'aria-label': 'Value' }}
              />
              <IconButton
                aria-label="Remove this credential"
                size="small"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                sx={{ alignSelf: 'center' }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Stack direction="row" alignItems="center" gap="12px" flexWrap="wrap" marginTop="4px">
              {authorization && (
                <FormControlLabel
                  sx={{ marginRight: 0 }}
                  control={
                    <Checkbox size="small" checked={f.bearer} onChange={(e) => set(i, { bearer: e.target.checked })} />
                  }
                  label={<Typography sx={text.caption}>Bearer token: sent as “Bearer &lt;value&gt;”</Typography>}
                />
              )}
              <Typography sx={text.caption}>Sent only to these hosts, separated by commas.</Typography>
            </Stack>
            {error && <Typography sx={{ ...text.caption, color: color.danger }}>{error}</Typography>}
          </Box>
        );
      })}
      {value.length < MAX_SANDBOX_SECRETS && (
        <Box>
          <Button size="small" variant="text" onClick={() => onChange([...value, emptyOwnSecret()])}>
            Add a credential for this sandbox
          </Button>
        </Box>
      )}
    </Stack>
  );
};

export default OwnSecretsEditor;
