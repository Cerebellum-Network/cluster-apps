import type { ReactNode } from 'react';
import { Box, Button, IconButton, Stack, TextField, Typography } from '@cluster-apps/ui';
import CloseIcon from '@mui/icons-material/Close';

import { credentialCoverage } from '~/compute/egressCoverage';
import { ANY_METHOD, emptyRule, RULE_METHODS, ruleFromForm, ruleProblem, type RuleForm } from '~/compute/egressRules';
import type { HttpMethod, SecretSummary } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { Chip } from '../../pages/SandboxList';
import { CoverageNote, CredentialSelect } from '../credentials/CredentialPicker';

const METHOD_CHOICES: { m: HttpMethod; label: string }[] = [
  ...RULE_METHODS.map((m) => ({ m, label: m })),
  { m: ANY_METHOD, label: 'Any' },
];

/** One rule: host, path prefix, credential (picked or stored here), methods, and what the gateway will say about it. */
export const RuleCard = ({
  rule,
  secrets,
  showError,
  disabled,
  note,
  onChange,
  onRemove,
}: {
  rule: RuleForm;
  secrets: SecretSummary[] | undefined;
  /** Show the rule's problem even before its host is typed (after a save attempt). */
  showError?: boolean;
  disabled?: boolean;
  note?: ReactNode;
  onChange: (patch: Partial<RuleForm>) => void;
  onRemove: () => void;
}) => {
  const api = ruleFromForm(rule);
  const problem = ruleProblem(api);
  const error = problem && (showError || rule.host.trim()) ? problem : null;
  const coverage = credentialCoverage(rule.credential, api.host, secrets);
  const toggle = (m: HttpMethod) => {
    if (m === ANY_METHOD) {
      onChange({ methods: rule.methods.includes(ANY_METHOD) ? ['GET'] : [ANY_METHOD] });
      return;
    }
    const without = rule.methods.filter((x) => x !== ANY_METHOD);
    onChange({ methods: without.includes(m) ? without.filter((x) => x !== m) : [...without, m] });
  };
  return (
    <Box sx={{ border: `1px solid ${color.border}`, borderRadius: '12px', padding: '12px 14px' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} gap="10px" alignItems={{ md: 'flex-start' }}>
        <TextField
          placeholder="api.example.com"
          value={rule.host}
          onChange={(e) => onChange({ host: e.target.value })}
          size="small"
          sx={{ flex: 1.3 }}
          error={!!error}
          disabled={disabled}
          inputProps={{ 'aria-label': 'Host', style: { fontFamily: mono, fontSize: 13 } }}
        />
        <TextField
          placeholder="/path prefix (optional)"
          value={rule.path}
          onChange={(e) => onChange({ path: e.target.value })}
          size="small"
          sx={{ flex: 1 }}
          disabled={disabled}
          inputProps={{ 'aria-label': 'Path prefix', style: { fontFamily: mono, fontSize: 13 } }}
        />
        <Box sx={{ flex: 1.1, minWidth: 0 }}>
          <CredentialSelect
            value={rule.credential}
            onChange={(credential) => onChange({ credential })}
            secrets={secrets}
            host={api.host}
            ariaLabel="Credential"
            disabled={disabled}
          />
        </Box>
        <IconButton
          aria-label="Remove this rule"
          size="small"
          onClick={onRemove}
          disabled={disabled}
          sx={{ alignSelf: 'center' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Stack direction="row" gap="6px" flexWrap="wrap" marginTop="10px" alignItems="center">
        {METHOD_CHOICES.map(({ m, label }) => (
          <Chip key={m} active={rule.methods.includes(m)} onClick={() => !disabled && toggle(m)}>
            {label}
          </Chip>
        ))}
        {note && <Box sx={{ ...text.caption, marginLeft: '6px' }}>{note}</Box>}
      </Stack>
      {error && <Typography sx={{ ...text.caption, color: color.danger, marginTop: '6px' }}>{error}</Typography>}
      {!error && rule.credential && (
        <Box marginTop="6px">
          <CoverageNote coverage={coverage} host={api.host} />
        </Box>
      )}
    </Box>
  );
};

/**
 * An egress allow-list as a list of rule cards: the same editor for a new
 * sandbox, a running one, and an agent definition. Nothing is reachable but
 * what it lists; a rule may name a credential, which the egress proxy adds.
 */
const RulesEditor = ({
  rules,
  onChange,
  secrets,
  showErrors,
  disabled,
  notes,
  empty = 'No hosts: nothing is reachable.',
  addLabel = 'Allow a host',
}: {
  rules: RuleForm[];
  onChange: (rules: RuleForm[]) => void;
  secrets: SecretSummary[] | undefined;
  showErrors?: boolean;
  disabled?: boolean;
  /** A note per rule (index-aligned), e.g. how many logged requests it let through. */
  notes?: ReactNode[];
  empty?: ReactNode;
  addLabel?: string;
}) => (
  <Stack gap="10px">
    {rules.length === 0 && <Typography sx={text.secondary}>{empty}</Typography>}
    {rules.map((r, i) => (
      <RuleCard
        key={i}
        rule={r}
        secrets={secrets}
        showError={showErrors}
        disabled={disabled}
        note={notes?.[i]}
        onChange={(patch) => onChange(rules.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
        onRemove={() => onChange(rules.filter((_, j) => j !== i))}
      />
    ))}
    {!disabled && (
      <Box>
        <Button size="small" variant="text" onClick={() => onChange([...rules, emptyRule()])}>
          {addLabel}
        </Button>
      </Box>
    )}
  </Stack>
);

export default RulesEditor;
