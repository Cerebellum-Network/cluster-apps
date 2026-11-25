import { Box, MenuItem, Stack, TextField, Typography } from '@cluster-apps/ui';
import { NavLink } from 'react-router-dom';

import { coverageProblem, type Coverage } from '~/compute/egressCoverage';
import type { SecretSummary } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { KeyGlyph, sbColor } from '../../Sandboxes/components/ui';
import { addSecretPath } from './MissingSecrets';

/** Where a secret's value may go, as the secrets API lists it. */
export const boundTo = (s: SecretSummary): string =>
  !s.hosts
    ? 'hosts not listed by this gateway'
    : s.hosts.length
      ? `sent only to ${s.hosts.join(', ')}`
      : 'sent nowhere';

/**
 * A bucket secret for a rule to name, by name, each with the hosts it is bound
 * to. A name the bucket doesn't hold (from a definition being edited) stays
 * selectable and says so.
 */
export const CredentialSelect = ({
  value,
  onChange,
  secrets,
  label,
  ariaLabel,
  noneLabel = 'No credential',
}: {
  value: string;
  onChange: (name: string) => void;
  secrets: SecretSummary[] | undefined;
  label?: string;
  ariaLabel?: string;
  noneLabel?: string;
}) => {
  const list = secrets ?? [];
  return (
    <TextField
      select
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      size="small"
      fullWidth
      SelectProps={{
        displayEmpty: true,
        renderValue: (v) =>
          v ? (
            <Box component="span" sx={{ fontFamily: mono, fontSize: 13 }}>
              {String(v)}
            </Box>
          ) : (
            <Box component="span" sx={{ color: color.textTertiary }}>
              {noneLabel}
            </Box>
          ),
      }}
      inputProps={{ 'aria-label': ariaLabel ?? label }}
    >
      <MenuItem value="">{noneLabel}</MenuItem>
      {list.map((s) => (
        <MenuItem key={s.name} value={s.name}>
          <Stack>
            <Stack direction="row" alignItems="center" gap="6px" sx={{ color: sbColor.credential }}>
              <KeyGlyph />
              <Box component="span" sx={{ fontFamily: mono, fontSize: 13, color: color.text }}>
                {s.name}
              </Box>
            </Stack>
            <Typography sx={{ ...text.caption, fontFamily: mono }}>{boundTo(s)}</Typography>
          </Stack>
        </MenuItem>
      ))}
      {value && !list.some((s) => s.name === value) && (
        <MenuItem value={value}>
          <Box component="span" sx={{ fontFamily: mono, fontSize: 13 }}>
            {value}
          </Box>
          <Box component="span" sx={{ ...text.caption, marginLeft: '8px', color: color.warning }}>
            {secrets ? 'not in this bucket' : ''}
          </Box>
        </MenuItem>
      )}
    </TextField>
  );
};

/**
 * What the gateway will make of a rule naming a credential: fine, or why the
 * create would be refused (`unknown_credential`, `credential_not_bound`) and a
 * link that opens Secrets with the name and the hosts to store it with.
 */
export const CoverageNote = ({ coverage, host }: { coverage: Coverage; host: string }) => {
  if (coverage.state === 'covered')
    return (
      <Typography sx={{ ...text.caption, color: color.success }}>
        {coverage.name} is sent only to {coverage.hosts.join(', ')}: this host is covered.
      </Typography>
    );
  if (coverage.state === 'unlisted')
    return (
      <Typography sx={text.caption}>
        The gateway doesn’t list the hosts {coverage.name} is bound to, so the console can’t check it.
      </Typography>
    );
  const problem = coverageProblem(coverage);
  if (!problem || (coverage.state !== 'missing' && coverage.state !== 'unbound' && coverage.state !== 'not-covered'))
    return null;
  const hosts = coverage.state === 'not-covered' ? [...coverage.hosts, coverage.host] : host ? [host] : [];
  return (
    <Typography sx={{ ...text.caption, color: color.warning }}>
      {problem}{' '}
      <NavLink to={addSecretPath(coverage.name, hosts)} target="_blank" rel="noreferrer">
        {coverage.state === 'missing' ? `Add ${coverage.name}` : `Store ${coverage.name} again`}
      </NavLink>
    </Typography>
  );
};
