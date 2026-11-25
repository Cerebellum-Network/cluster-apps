import { useMemo, useState } from 'react';
import { Alert, Box, Button, LoadingButton, Stack, Typography } from '@cluster-apps/ui';
import { NavLink } from 'react-router-dom';

import { useAccount } from '~/hooks';
import type { AgentDefinition } from '~/compute/agentDefinition';
import { LABEL, modelRule } from '~/compute/agentRun';
import { saveAgent } from '~/compute/agentStore';
import { errorMessage } from '~/compute/client';
import { coverageBlocks, credentialCoverage } from '~/compute/egressCoverage';
import { allowRule, denials, formFromRule, rulesFromForms, sameRules, type RuleForm } from '~/compute/egressRules';
import { fmtAgo, plural } from '~/compute/format';
import { useEgressLog, useNow, useSecrets } from '~/compute/hooks';
import { NO_WALLET_HERE, useCanSign } from '~/compute/walletSigning';
import { isLive, type Sandbox } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { useCredentialDialogs } from '../../Sandboxes/components/credentials/CredentialDialogs';
import { CoverageNote } from '../../Sandboxes/components/credentials/CredentialPicker';
import RulesEditor from '../../Sandboxes/components/egress/RulesEditor';
import { CredentialChip, Mono, ReadError, sbColor } from '../../Sandboxes/components/ui';

const WEEK_MS = 7 * 86_400_000;

/**
 * An agent's network access: the rules every run's sandbox starts with (saved
 * in the definition, so the next runs get them), the model's rule the run adds,
 * each with its credential, picked from the bucket or stored here; and the
 * hosts its runs were refused this week, each with a button to allow it for
 * the next runs. A run still going can be changed on its own page.
 */
const AgentEgress = ({
  bucket,
  def,
  runs,
  onSaved,
}: {
  bucket: string;
  def: AgentDefinition;
  /** This agent's run sandboxes, newest first. */
  runs: Sandbox[];
  onSaved: () => void;
}) => {
  const account = useAccount();
  const canSign = useCanSign();
  const dialogs = useCredentialDialogs();
  const secrets = useSecrets();
  const now = useNow(10_000);
  const saved = useMemo(() => def.egress?.allow ?? [], [def]);
  const [draft, setDraft] = useState<RuleForm[] | null>(null);
  const forms = draft ?? saved.map(formFromRule);
  const parsed = rulesFromForms(forms);
  const dirty = !!draft && !sameRules(parsed.allow, saved);
  const model = modelRule(def);
  const credBlocks = parsed.allow.some((r) => coverageBlocks(credentialCoverage(r.credential, r.host, secrets.data)));
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [since] = useState(() => new Date(Date.now() - WEEK_MS).toISOString());
  const log = useEgressLog({ decision: 'denied', since }, { max: 500 });
  const runIds = useMemo(() => new Map(runs.map((s) => [s.id, s])), [runs]);
  const refused = useMemo(
    () =>
      denials(
        (log.data?.items ?? []).filter((e) => e.sandbox_id && runIds.has(e.sandbox_id)),
        () => [...parsed.allow, model],
      ),
    // parsed/model change with the draft: what the draft would allow drops out as it is added.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [log.data, runIds, JSON.stringify(parsed.allow), JSON.stringify(model)],
  );
  const byHost = useMemo(() => {
    const m = new Map<string, { methods: Set<string>; count: number; last: string; runs: Set<string> }>();
    for (const d of refused) {
      const cur = m.get(d.host) ?? { methods: new Set<string>(), count: 0, last: d.last, runs: new Set<string>() };
      d.methods.forEach((x) => cur.methods.add(x));
      cur.count += d.count;
      if (Date.parse(d.last) > Date.parse(cur.last)) cur.last = d.last;
      if (d.sandboxId) cur.runs.add(d.sandboxId);
      m.set(d.host, cur);
    }
    return [...m.entries()].sort((a, b) => Date.parse(b[1].last) - Date.parse(a[1].last));
  }, [refused]);

  const save = async () => {
    setAttempted(true);
    if (!parsed.ok) return;
    setSaving(true);
    setError(null);
    try {
      const next: AgentDefinition = { ...def };
      if (parsed.allow.length || def.egress) next.egress = { allow: parsed.allow };
      await saveAgent(account.storage, bucket, next);
      setDraft(null);
      setAttempted(false);
      setNotice(`Saved to ${bucket}. Runs from now on start with these rules.`);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing="16px">
      {byHost.length > 0 && (
        <Box
          sx={{
            border: `1px solid ${sbColor.deniedText}`,
            backgroundColor: sbColor.deniedTint,
            borderRadius: '12px',
            padding: '12px 14px',
          }}
        >
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: sbColor.deniedText, marginBottom: '6px' }}>
            Refused to this agent’s runs in the last 7 days
          </Typography>
          <Stack gap="8px">
            {byHost.map(([host, h]) => {
              const live = [...h.runs].map((id) => runIds.get(id)).find((s) => s && isLive(s.status));
              const runId = live?.labels[LABEL.run];
              return (
                <Stack
                  key={host}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap="12px"
                  flexWrap="wrap"
                >
                  <Typography sx={{ fontSize: 13.5 }}>
                    <Mono>{host}</Mono>{' '}
                    <Box component="span" sx={text.caption}>
                      {[...h.methods].join(', ')} · {plural(h.count, 'request')} in {plural(h.runs.size, 'run')} ·{' '}
                      {fmtAgo(h.last, now)}
                    </Box>
                  </Typography>
                  <Stack direction="row" gap="8px">
                    {runId && (
                      <Button size="small" variant="outlined" component={NavLink} to={`/agents/runs/${runId}`}>
                        Allow for the running run
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => {
                        const added = allowRule(parsed.allow, { host, methods: [...h.methods] as never });
                        setDraft(added.map(formFromRule));
                        setNotice(null);
                      }}
                    >
                      Allow for next runs
                    </Button>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
          <Typography sx={{ ...text.caption, marginTop: '8px' }}>
            “Allow for next runs” adds a rule below; pick a credential if the host needs one, then save.
          </Typography>
        </Box>
      )}
      {log.error && !log.data && <ReadError what="your runs’ egress log" error={log.error} />}

      <Box>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap="12px" marginBottom="8px">
          <Typography sx={text.label}>Allowed on every run</Typography>
          <Button size="small" variant="text" color="secondary" onClick={dialogs.manage}>
            Credentials in this bucket
          </Button>
        </Stack>
        <RulesEditor
          rules={forms}
          onChange={(rs) => {
            setDraft(rs);
            setNotice(null);
          }}
          secrets={secrets.data}
          showErrors={attempted}
          empty="No hosts besides the model: the agent reaches nothing else."
        />
        <Box
          sx={{
            marginTop: '10px',
            border: `1px dashed ${color.border}`,
            borderRadius: '12px',
            padding: '10px 14px',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap="10px">
            <Box minWidth={0}>
              <Box component="span" sx={{ fontFamily: mono, fontSize: 12.5, fontWeight: 600 }}>
                {model.host}
                {model.path_prefix ?? ''}
              </Box>
              <Box component="span" sx={{ ...text.caption, marginLeft: '6px' }}>
                {model.methods.join(', ')} · the model, added by every run (change it with Edit)
              </Box>
            </Box>
            <CredentialChip name={model.credential ?? null} />
          </Stack>
          {model.credential && (
            <Box marginTop="6px">
              <CoverageNote
                coverage={credentialCoverage(model.credential, model.host, secrets.data)}
                host={model.host}
              />
            </Box>
          )}
        </Box>
        {(dirty || error) && (
          <Stack direction="row" gap="10px" alignItems="center" marginTop="12px" flexWrap="wrap">
            <LoadingButton
              variant="contained"
              size="small"
              loading={saving}
              disabled={!dirty || !canSign}
              onClick={save}
            >
              Save to {bucket}
            </LoadingButton>
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              onClick={() => {
                setDraft(null);
                setError(null);
                setAttempted(false);
              }}
            >
              Discard
            </Button>
            {!canSign && <Typography sx={text.caption}>{NO_WALLET_HERE}</Typography>}
            {credBlocks && (
              <Typography sx={{ ...text.caption, color: color.warning }}>
                A rule’s credential can’t be sent to its host yet: a run would be refused until it is stored again.
              </Typography>
            )}
          </Stack>
        )}
        {error && (
          <Alert severity="error" sx={{ marginTop: '10px' }}>
            Couldn’t save: {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" sx={{ marginTop: '10px' }} onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        )}
        <Typography sx={{ ...text.caption, marginTop: '10px' }}>
          Saved in the definition, so runs from then on start with them. A run already going keeps its own rules; change
          those on the run’s page. Credentials are kept for the bucket, bound to their hosts, and the agent never sees
          them.
        </Typography>
      </Box>
    </Stack>
  );
};

export default AgentEgress;
