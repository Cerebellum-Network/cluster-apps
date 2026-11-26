import { Box, MenuItem, Stack, TextField, Typography } from '@cluster-apps/ui';
import { Autocomplete, Link } from '@mui/material';

import { scopeLabel, type Credential } from '~/compute/credentials';
import { coverageProblem, type Coverage } from '~/compute/egressCoverage';
import { MAX_PLACEHOLDERS } from '~/compute/egressRules';
import type { SecretSummary } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { KeyGlyph, sbColor } from '../ui';
import { useCredentialDialogs } from './CredentialDialogs';

/** A credential a rule can pick: a bucket secret, or one resolved with its scope (credentials.ts). */
export type Pickable = Pick<SecretSummary, 'name' | 'hosts'> &
  Partial<Pick<Credential, 'scope' | 'agent' | 'overrides'>>;

/** Where a secret's value may go, as the secrets API lists it. */
export const boundTo = (s: Pick<SecretSummary, 'hosts'>): string =>
  s.hosts.length ? `sent only to ${s.hosts.join(', ')}` : 'sent nowhere';

/** "sent only to api.github.com", with where it comes from when that is not the bucket. */
const caption = (s: Pickable): string => {
  const from = s.scope && s.scope !== 'bucket' ? `${scopeLabel(s as Credential)}’s, ` : '';
  const wins = s.overrides?.length
    ? ` (wins over ${s.overrides.map((o) => (o === 'bucket' ? 'the bucket’s' : 'the agent’s')).join(' and ')})`
    : '';
  return `${from}${boundTo(s)}${wins}`;
};

const NEW = '__new__';
const PER_REQUEST = '__per_request__';

/**
 * A credential for a rule to name, by name, each with the hosts it is bound
 * to and, for a sandbox's own or an agent's, where it comes from; and "New
 * credential…", which stores one for the bucket bound to `host` and picks it.
 * A name nothing holds (from a definition being edited) stays selectable and
 * says so.
 *
 * With `onPlaceholders`, it also offers "Picked per request…": the rule then
 * lists credentials the sandbox names per request (`cere:<name>` in a header),
 * which the egress proxy swaps for the credential's header and value. That is
 * how two accounts on one host (two Slack workspaces) are told apart.
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
  placeholders,
  onPlaceholders,
}: {
  value: string;
  onChange: (name: string) => void;
  secrets: Pickable[] | undefined;
  /** The rule's host: a new credential starts bound to it. */
  host?: string;
  label?: string;
  ariaLabel?: string;
  noneLabel?: string;
  disabled?: boolean;
  /** The rule's placeholders; null (or absent) when it names one credential or none. */
  placeholders?: string[] | null;
  onPlaceholders?: (names: string[] | null) => void;
}) => {
  const dialogs = useCredentialDialogs();
  const list = secrets ?? [];
  const perRequest = !!onPlaceholders && !!placeholders;
  const pick = (v: string) => {
    if (v === PER_REQUEST) {
      onPlaceholders?.(value ? [value] : []);
      onChange('');
      return;
    }
    if (perRequest) onPlaceholders?.(null);
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
    <Stack gap="8px">
      <TextField
        select
        label={label}
        value={perRequest ? PER_REQUEST : value}
        onChange={(e) => pick(e.target.value)}
        size="small"
        fullWidth
        disabled={disabled}
        SelectProps={{
          displayEmpty: true,
          renderValue: (v) =>
            v === PER_REQUEST ? (
              <Box component="span" sx={{ fontSize: 13 }}>
                Picked per request
              </Box>
            ) : v ? (
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
              <Typography sx={{ ...text.caption, fontFamily: mono }}>{caption(s)}</Typography>
            </Stack>
          </MenuItem>
        ))}
        {value && !list.some((s) => s.name === value) && (
          <MenuItem value={value}>
            <Box component="span" sx={{ fontFamily: mono, fontSize: 13 }}>
              {value}
            </Box>
            <Box component="span" sx={{ ...text.caption, marginLeft: '8px', color: color.warning }}>
              {secrets ? 'not stored' : ''}
            </Box>
          </MenuItem>
        )}
        {onPlaceholders && (
          <MenuItem value={PER_REQUEST} sx={{ borderTop: `1px solid ${color.grid}` }}>
            <Stack>
              <Box component="span" sx={{ fontSize: 13, fontWeight: 600 }}>
                Picked per request…
              </Box>
              <Typography sx={text.caption}>The sandbox names one of several in a header</Typography>
            </Stack>
          </MenuItem>
        )}
        <MenuItem value={NEW} sx={{ color: color.primary, fontWeight: 600, borderTop: `1px solid ${color.grid}` }}>
          New credential…
        </MenuItem>
      </TextField>
      {perRequest && (
        <Autocomplete
          multiple
          freeSolo
          size="small"
          disabled={disabled}
          options={list.map((s) => s.name)}
          value={placeholders ?? []}
          onChange={(_, v) => onPlaceholders?.([...new Set(v.map((x) => String(x).trim()).filter(Boolean))])}
          renderInput={(p) => (
            <TextField
              {...p}
              placeholder={placeholders?.length ? '' : 'Credentials it may name'}
              inputProps={{ ...p.inputProps, 'aria-label': 'Credentials picked per request' }}
              error={(placeholders?.length ?? 0) > MAX_PLACEHOLDERS}
            />
          )}
        />
      )}
    </Stack>
  );
};

/** How placeholder mode reads, for under a rule that uses it. */
export const PlaceholderHint = ({ names }: { names: string[] }) => (
  <Typography sx={text.caption}>
    The sandbox writes{' '}
    <Box component="span" sx={{ fontFamily: mono }}>
      cere:{names[0] ?? '<name>'}
    </Box>{' '}
    in a header (for example{' '}
    <Box component="span" sx={{ fontFamily: mono }}>
      Authorization: Bearer cere:{names[0] ?? '<name>'}
    </Box>
    ); the egress proxy replaces the header with that credential’s, on HTTPS requests to its hosts only.
  </Typography>
);

/**
 * What the gateway will make of a rule naming a credential: fine, or why it
 * would be refused (`unknown_credential`, `credential_not_bound`), with the
 * action that fixes it: store the credential, or store it again with this host.
 */
export const CoverageNote = ({ coverage, host }: { coverage: Coverage; host: string }) => {
  const dialogs = useCredentialDialogs();
  const from =
    'scope' in coverage && coverage.scope && coverage.scope !== 'bucket'
      ? ` (${scopeLabel({ scope: coverage.scope, agent: coverage.agent })}’s)`
      : '';
  if (coverage.state === 'covered')
    return (
      <Typography sx={{ ...text.caption, color: color.success }}>
        {coverage.name}
        {from} is sent only to {coverage.hosts.join(', ')}: this host is covered.
      </Typography>
    );
  const problem = coverageProblem(coverage);
  if (!problem || (coverage.state !== 'missing' && coverage.state !== 'unbound' && coverage.state !== 'not-covered'))
    return null;
  const hosts = coverage.state === 'not-covered' ? [...coverage.hosts, coverage.host] : host ? [host] : [];
  // A sandbox's own credential keeps the hosts it was created with: nothing to store again.
  const own = coverage.state !== 'missing' && coverage.scope === 'sandbox';
  const agent = coverage.state !== 'missing' && coverage.scope === 'agent' ? coverage.agent : undefined;
  return (
    <Typography sx={{ ...text.caption, color: color.warning }}>
      {problem}{' '}
      {!own && (
        <Link
          component="button"
          type="button"
          variant="caption"
          sx={{ verticalAlign: 'baseline', fontWeight: 600 }}
          onClick={() =>
            void dialogs.store(
              coverage.state === 'missing'
                ? { suggested: coverage.name, hosts }
                : { name: coverage.name, hosts, agent, purpose: `So it is sent to ${host} too.` },
            )
          }
        >
          {coverage.state === 'missing' ? `Add ${coverage.name}` : `Store ${coverage.name} again`}
        </Link>
      )}
    </Typography>
  );
};
