import { useMemo, useState } from 'react';
import { Alert, Box, Button, LoadingButton, Stack, Typography } from '@cluster-apps/ui';

import { useComputeClient } from '~/compute/ComputeProvider';
import { ComputeError, errorMessage } from '~/compute/client';
import { agentOf, credentialsOfSandbox } from '~/compute/credentials';
import { rulesBlocked } from '~/compute/egressCoverage';
import {
  allowRule,
  denials,
  formFromRule,
  requestedMethod,
  ruleHostMatches,
  rulesFromForms,
  sameRules,
  type Denial,
  type RuleForm,
} from '~/compute/egressRules';
import { plural } from '~/compute/format';
import { useEgressLog, useSecrets, type Polled } from '~/compute/hooks';
import { isLive, type EgressEntry, type EgressRule, type Sandbox } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { useCredentialDialogs } from '../credentials/CredentialDialogs';
import EgressTable from '../detail/EgressTable';
import { Mono, ReadError, RuleCredentials, sbColor } from '../ui';
import AllowHostDialog from './AllowHostDialog';
import RulesEditor from './RulesEditor';

/** A gateway without the route answers 404/405 with no code of its own. */
const unsupported = (e: unknown) => e instanceof ComputeError && (e.status === 405 || (e.status === 404 && !e.code));

/** What a refused rule change means, in words. */
export function egressChangeError(e: unknown): string {
  if (unsupported(e)) return 'This cluster’s API can’t change a running sandbox’s rules yet.';
  if (e instanceof ComputeError && e.code === 'not_running')
    return 'The sandbox has ended, so its rules no longer apply.';
  return errorMessage(e);
}

/** Requests in the log a rule's host matches, allowed and not. */
const hitsNote = (rule: EgressRule, entries: EgressEntry[]) => {
  const hits = entries.filter((e) => e.decision !== 'policy' && ruleHostMatches(rule.host, e.host));
  const ok = hits.filter((e) => e.decision === 'allowed').length;
  return `${plural(ok, 'request')} allowed${hits.length - ok ? `, ${hits.length - ok} denied or failed` : ''}`;
};

/** The hosts the agent (or anything in the sandbox) was refused, with one button each to allow it. */
const DeniedNow = ({ list, onAllow }: { list: Denial[]; onAllow: (d: Denial) => void }) => (
  <Box
    sx={{
      border: `1px solid ${sbColor.deniedText}`,
      backgroundColor: sbColor.deniedTint,
      borderRadius: '12px',
      padding: '12px 14px',
      marginBottom: '14px',
    }}
  >
    <Typography sx={{ fontSize: 14, fontWeight: 700, color: sbColor.deniedText, marginBottom: '6px' }}>
      Refused by the egress proxy: {plural(list.length, 'host')}
    </Typography>
    <Stack gap="8px">
      {list.map((d) => (
        <Stack
          key={d.host}
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap="12px"
          flexWrap="wrap"
        >
          <Typography sx={{ fontSize: 13.5 }}>
            <Mono>{d.host}</Mono>{' '}
            <Box component="span" sx={text.caption}>
              {d.methods.join(', ')} · {plural(d.count, 'request')}
              {d.entry.reason ? ` · ${d.entry.reason}` : ''}
            </Box>
          </Typography>
          <Button size="small" variant="contained" onClick={() => onAllow(d)}>
            Allow {d.host}
          </Button>
        </Stack>
      ))}
    </Stack>
  </Box>
);

/**
 * A sandbox's network access: its allow-list, which can be changed while it
 * runs (`PUT /v1/sandboxes/{id}/egress`, from the next request on), the hosts
 * it was refused with a button to allow each, and its egress log, where a
 * denied request can be allowed too. Credentials are picked or stored inline;
 * they belong to the bucket so other sandboxes and agents can reuse them.
 */
const SandboxEgress = ({
  sb,
  onUpdated,
  log,
}: {
  sb: Sandbox;
  onUpdated: (sb: Sandbox) => void;
  /** The page's own read of this sandbox's egress log, when it has one (else this panel reads it). */
  log?: Polled<{ items: EgressEntry[]; truncated: boolean }>;
}) => {
  const client = useComputeClient();
  const dialogs = useCredentialDialogs();
  const secrets = useSecrets();
  const own = useEgressLog({ sandbox_id: sb.id }, { enabled: !log });
  const egress = log ?? own;
  const live = isLive(sb.status);
  const entries = useMemo(() => egress.data?.items ?? [], [egress.data]);
  const server = sb.egress.allow;
  const [draft, setDraft] = useState<RuleForm[] | null>(null);
  const forms = draft ?? server.map(formFromRule);
  const parsed = rulesFromForms(forms);
  const dirty = !!draft && !sameRules(parsed.allow, server);
  // A name resolves in the sandbox's own credentials, then its agent's, then the bucket's.
  const creds = useMemo(() => credentialsOfSandbox(secrets.data, sb), [secrets.data, sb]);
  const credBlocks = rulesBlocked(parsed.allow, creds);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [allowing, setAllowing] = useState<{ host: string; methods: EgressRule['methods'] } | null>(null);
  const refused = useMemo(() => denials(entries, () => server), [entries, server]);
  const deniedCount = entries.filter((e) => e.decision === 'denied').length;
  const requests = entries.filter((e) => e.decision !== 'policy').length;

  const apply = async (allow: EgressRule[]) => {
    const next = await client.setEgress(sb.id, { allow });
    onUpdated(next);
    egress.reload();
    return next;
  };

  const save = async () => {
    setAttempted(true);
    if (!parsed.ok || credBlocks) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apply(parsed.allow);
      setDraft(null);
      setAttempted(false);
      setNotice('Saved. The egress proxy applies these rules from the next request.');
    } catch (e) {
      setSaveError(egressChangeError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      {live && refused.length > 0 && (
        <DeniedNow list={refused} onAllow={(d) => setAllowing({ host: d.host, methods: d.methods })} />
      )}
      <Box
        sx={{ border: `1px solid ${color.border}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '14px' }}
      >
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap="12px" marginBottom="8px">
          <Typography sx={text.label}>Allowed for this sandbox</Typography>
          <Button size="small" variant="text" color="secondary" onClick={() => dialogs.manage()}>
            Credentials in this bucket
          </Button>
        </Stack>
        {live ? (
          <>
            <RulesEditor
              rules={forms}
              onChange={(rs) => {
                setDraft(rs);
                setNotice(null);
              }}
              secrets={creds}
              showErrors={attempted}
              notes={server.length === forms.length && !dirty ? server.map((r) => hitsNote(r, entries)) : undefined}
              empty="No hosts allowed: this sandbox has no network access. Allow one below, or from a refused request."
            />
            {(dirty || saveError) && (
              <Stack direction="row" gap="10px" alignItems="center" marginTop="12px" flexWrap="wrap">
                <LoadingButton variant="contained" size="small" loading={saving} disabled={!dirty} onClick={save}>
                  Save rules
                </LoadingButton>
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  onClick={() => {
                    setDraft(null);
                    setSaveError(null);
                    setAttempted(false);
                  }}
                >
                  Discard
                </Button>
                {attempted && credBlocks && (
                  <Typography sx={{ ...text.caption, color: color.warning }}>
                    A rule’s credential can’t be sent to its host; store it again with that host first.
                  </Typography>
                )}
              </Stack>
            )}
            {saveError && (
              <Alert severity="error" sx={{ marginTop: '10px' }}>
                {saveError}
              </Alert>
            )}
            {notice && (
              <Alert severity="success" sx={{ marginTop: '10px' }} onClose={() => setNotice(null)}>
                {notice}
              </Alert>
            )}
            <Typography sx={{ ...text.caption, marginTop: '10px' }}>
              Changes apply from the next request, on this running sandbox only, and each one is written to its egress
              log. A credential is sent only to the hosts it is bound to.
            </Typography>
          </>
        ) : (
          <>
            {server.length ? (
              <Stack spacing="8px">
                {server.map((r, i) => (
                  <Stack
                    key={`${r.host}-${i}`}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap="8px"
                  >
                    <Box minWidth={0}>
                      <Box component="span" sx={{ fontFamily: mono, fontSize: 12.5, fontWeight: 600 }}>
                        {r.host}
                        {r.path_prefix ?? ''}
                      </Box>
                      <Box component="span" sx={{ ...text.caption, marginLeft: '6px' }}>
                        {r.methods.join(', ')} · {hitsNote(r, entries)}
                      </Box>
                    </Box>
                    <RuleCredentials rule={r} />
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography sx={text.secondary}>No hosts were allowed: this sandbox had no network access.</Typography>
            )}
            <Typography sx={{ ...text.caption, marginTop: '10px' }}>
              The sandbox has ended; these were its last rules.
            </Typography>
          </>
        )}
      </Box>

      <Typography sx={{ ...text.secondary, marginBottom: '10px' }}>
        {plural(requests, 'request')}, {deniedCount} denied. The egress proxy adds credentials on the way out; the
        sandbox never holds them.
      </Typography>
      {egress.error && !egress.data ? (
        <ReadError what="the egress log" error={egress.error} />
      ) : (
        <EgressTable
          entries={entries}
          empty="No requests yet. Try one from the Exec tab."
          onAllow={live ? (e) => setAllowing({ host: e.host.toLowerCase(), methods: [requestedMethod(e)] }) : undefined}
          canAllow={(e) => refused.some((d) => d.host === e.host.toLowerCase())}
        />
      )}

      {allowing && (
        <AllowHostDialog
          host={allowing.host}
          methods={allowing.methods}
          scope={{ own: sb.secrets, agent: agentOf(sb) }}
          title={
            <span>
              Allow <Mono>{allowing.host}</Mono> for this sandbox
            </span>
          }
          target={
            <>
              sandbox <Mono>{sb.id}</Mono>
            </>
          }
          onAllow={async (rule) => {
            try {
              await apply(allowRule(server, rule));
            } catch (e) {
              throw new Error(egressChangeError(e));
            }
          }}
          onClose={(rule) => {
            setAllowing(null);
            if (rule) {
              setDraft(null);
              setNotice(
                `Allowed ${rule.methods.join(', ')} ${rule.host}${rule.path_prefix ?? ''}. The next request goes through.`,
              );
            }
          }}
        />
      )}
    </Box>
  );
};

export default SandboxEgress;
