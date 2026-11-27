import { useState, type ReactNode } from 'react';
import { Alert, Button, LoadingButton, Stack, Typography } from '@cluster-apps/ui';
import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { errorMessage } from '~/compute/client';
import { credentialsFor } from '~/compute/credentials';
import { rulesBlocked } from '~/compute/egressCoverage';
import { emptyRule, ruleFromForm, ruleProblem, type RuleForm } from '~/compute/egressRules';
import { useSecrets } from '~/compute/hooks';
import type { EgressRule, HttpMethod, SandboxSecret } from '~/compute/types';
import { text } from '~/theme/tokens';
import { Mono } from '../ui';
import { RuleCard } from './RulesEditor';

/**
 * "Allow <host> for this sandbox": one rule, filled from a request the egress
 * proxy denied (host and method), with a credential picked from the bucket or
 * stored here bound to that host. `onAllow` applies it (a running sandbox's
 * `PUT /egress`, or an agent definition's rules) and throws what the gateway
 * said when it refuses.
 */
const AllowHostDialog = ({
  host,
  methods,
  title,
  target,
  saveLabel = 'Allow',
  scope,
  onAllow,
  onClose,
}: {
  host: string;
  methods: HttpMethod[];
  title?: ReactNode;
  /** What the rule is added to, in words: "sandbox sb-… (running)". */
  target: ReactNode;
  saveLabel?: string;
  /** Where the rule's credential names resolve besides the bucket: the sandbox's own, its agent's. */
  scope?: { own?: SandboxSecret[]; agent?: string | null };
  onAllow: (rule: EgressRule) => Promise<void>;
  onClose: (allowed?: EgressRule) => void;
}) => {
  const secrets = useSecrets();
  const creds = credentialsFor(secrets.data, scope);
  const [rule, setRule] = useState<RuleForm>(() => emptyRule(host, methods.length ? methods : ['GET']));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = ruleFromForm(rule);
  const blocked =
    !!ruleProblem(api) || (!!rule.placeholders && !rule.placeholders.length) || rulesBlocked([api], creds);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onAllow(api);
      onClose(api);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={() => onClose()} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {title ?? (
          <span>
            Allow <Mono>{host}</Mono>
          </span>
        )}
        <IconButton aria-label="Close" onClick={() => onClose()} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography sx={text.secondary}>
            Adds this rule to {target}. The egress proxy applies it from the next request, so whatever was refused can
            simply try again. If the host needs a key, pick a credential or add one: it is stored for the bucket, bound
            to this host, and the sandbox never sees it.
          </Typography>
          <RuleCard
            rule={rule}
            secrets={creds}
            showError
            onChange={(patch) => setRule((r) => ({ ...r, ...patch }))}
            onRemove={() => onClose()}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ padding: '14px 24px' }}>
        <Button variant="outlined" color="secondary" onClick={() => onClose()}>
          Cancel
        </Button>
        <LoadingButton variant="contained" loading={busy} disabled={blocked} onClick={save}>
          {saveLabel}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

export default AllowHostDialog;
