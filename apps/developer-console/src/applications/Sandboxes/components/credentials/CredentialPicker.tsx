import { Box, MenuItem, Stack, TextField, Typography } from '@cluster-apps/ui';
import { Link } from '@mui/material';

import { coverageProblem, type Coverage } from '~/compute/egressCoverage';
import type { SecretSummary } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { KeyGlyph, sbColor } from '../ui';
import { useCredentialDialogs } from './CredentialDialogs';

/** Where a secret's value may go, as the secrets API lists it. */
export const boundTo = (s: SecretSummary): string =>
  !s.hosts
    ? 'hosts not listed by this gateway'
    : s.hosts.length
      ? `sent only to ${s.hosts.join(', ')}`
      : 'sent nowhere';

const NEW = '__new__';

/**
 * A bucket credential for a rule to name, by name, each with the hosts it is
 * bound to, and "New credential…", which stores one bound to `host` and picks
 * it. A name the bucket doesn't hold (from a definition being edited) stays
 * selectable and says so.
 */
export const CredentialSelect = ({
  value,
  onChange,
  secrets,
  host,
  label,
  ariaLabel,
  noneLabel = 'No credential',
  disabled,
}: {
  value: string;
  onChange: (name: string) => void;
  secrets: SecretSummary[] | undefined;
  /** The rule's host: a new credential starts bound to it. */
  host?: string;
  label?: string;
  ariaLabel?: string;
  noneLabel?: string;
  disabled?: boolean;
}) => {
  const dialogs = useCredentialDialogs();
  const list = secrets ?? [];
  const pick = (v: string) => {
    if (v !== NEW) {
      onChange(v);
      return;
    }
    const h = (host ?? '').trim().toLowerCase();
    void dialogs
      .store({ hosts: h ? [h] : [], purpose: h ? `For requests to ${h}.` : undefined })
      .then((name) => name && onChange(name));
  };
  return (
    <TextField
      select
      label={label}
      value={value}
      onChange={(e) => pick(e.target.value)}
      size="small"
      fullWidth
      disabled={disabled}
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
      <MenuItem value={NEW} sx={{ color: color.primary, fontWeight: 600, borderTop: `1px solid ${color.grid}` }}>
        New credential…
      </MenuItem>
    </TextField>
  );
};

/**
 * What the gateway will make of a rule naming a credential: fine, or why it
 * would be refused (`unknown_credential`, `credential_not_bound`), with the
 * action that fixes it: store the credential, or store it again with this host.
 */
export const CoverageNote = ({ coverage, host }: { coverage: Coverage; host: string }) => {
  const dialogs = useCredentialDialogs();
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
      <Link
        component="button"
        type="button"
        variant="caption"
        sx={{ verticalAlign: 'baseline', fontWeight: 600 }}
        onClick={() =>
          void dialogs.store(
            coverage.state === 'missing'
              ? { suggested: coverage.name, hosts }
              : { name: coverage.name, hosts, purpose: `So it is sent to ${host} too.` },
          )
        }
      >
        {coverage.state === 'missing' ? `Add ${coverage.name}` : `Store ${coverage.name} again`}
      </Link>
    </Typography>
  );
};
