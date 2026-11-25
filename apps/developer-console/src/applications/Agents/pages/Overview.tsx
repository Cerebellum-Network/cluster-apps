import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@cluster-apps/ui';
import { NavLink } from 'react-router-dom';

import { PageHeader, Pill, Section } from '~/components';
import { useAccount } from '~/hooks';
import { useAgentDefinitions } from '~/compute/agentHooks';
import { bucketList, bucketNames } from '~/compute/agentStore';
import { AGENT_RUN_KIND, LABEL } from '~/compute/agentRun';
import { useCompute } from '~/compute/ComputeProvider';
import { useSandboxes, useSecrets } from '~/compute/hooks';
import { useCanSign } from '~/compute/walletSigning';
import { fmtAgo, shortImage } from '~/compute/format';
import { inferenceConfig } from '~/inference/inferenceConfig';
import { color, mono, text } from '~/theme/tokens';
import { CodeBlock } from '../../Sandboxes/components/bits';
import TokenSecretButton, { MODEL_KEY_SECRET } from '../../Sandboxes/components/TokenSecretButton';
import { BucketChip, CredentialChip, Mono, ReadError } from '../../Sandboxes/components/ui';
import AddDefinitionDialog from '../components/AddDefinitionDialog';
import { addSecretPath } from '../components/MissingSecrets';
import { agentPath, EXAMPLE_MODEL_URL, missingSecrets, onConsoleGateway } from '../components/definition';
import RunsTable, { liveRuns, runRows } from '../components/RunsTable';

const FROM_A_TERMINAL = `gh release download cli/v0.1.4 -R Cerebellum-Network/ddc-node -p '*.json'
cere agent run -f research.json "Write a short brief on how gVisor isolates containers, citing https://gvisor.dev/docs/"
cere agent runs`;

const Overview = () => {
  const account = useAccount();
  const { bucketId } = useCompute();
  const canSign = useCanSign();
  const list = bucketList(account.buckets, account.bucketsError);
  const defs = useAgentDefinitions(bucketNames(list));
  const secrets = useSecrets();
  const runs = useSandboxes({ label: [`${LABEL.kind}:${AGENT_RUN_KIND}`] });
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const rows = runRows(runs.data?.items ?? [], liveRuns());
  const modelKey = secrets.data?.find((x) => x.name === MODEL_KEY_SECRET);
  const examplesOnConsoleGateway = onConsoleGateway(EXAMPLE_MODEL_URL, inferenceConfig.gatewayUrl);

  return (
    <Box>
      <Box marginBottom="20px">
        <PageHeader
          title="Agents"
          subtitle="An agent is a definition in one of your storage buckets: an image, a model, tools and network rules. Each run is a sandbox the console creates, runs the agent in, and terminates, keeping its output."
          actions={
            <>
              <BucketChip bucketId={bucketId} />
              <Button variant="contained" onClick={() => setAdding(true)}>
                Add a definition
              </Button>
            </>
          }
        />
      </Box>

      {saved && (
        <Alert severity="success" onClose={() => setSaved(null)} sx={{ marginBottom: '16px' }}>
          {saved}
        </Alert>
      )}

      {list.state === 'stale' && (
        <Alert severity="warning" sx={{ marginBottom: '12px' }}>
          Couldn’t refresh your bucket list, so definitions in a bucket created since may be missing: {list.error}
        </Alert>
      )}

      {defs.failed.map((f) => (
        <Alert key={f.bucket} severity="warning" sx={{ marginBottom: '12px' }}>
          Couldn’t list definitions in bucket {f.bucket}: {f.error}
        </Alert>
      ))}

      {defs.loading && defs.agents.length === 0 ? (
        <Stack direction="row" alignItems="center" gap="12px" padding="24px 0">
          <CircularProgress size={18} />
          <Typography sx={text.secondary}>Reading definitions from your buckets…</Typography>
        </Stack>
      ) : defs.error ? (
        <ReadError what="agent definitions" error={defs.error} />
      ) : !canSign ? (
        <Section>
          <Typography sx={text.body}>
            Agent definitions live in your storage buckets on the DDC S3 gateway (
            <Box component="span" sx={{ fontFamily: mono }}>
              cere/agents/&lt;name&gt;.json
            </Box>
            ), which only your wallet can read, and this development view has no wallet: sign in with your SSCP wallet
            to see them. The runs below are read with the access token.
          </Typography>
        </Section>
      ) : list.state === 'unreadable' ? (
        <ReadError what="your storage buckets, where agent definitions live" error={list.error} />
      ) : defs.agents.length === 0 ? (
        <Section>
          <Typography sx={text.body}>
            No agent definitions in your buckets yet. Add one here, or push one from a terminal (below). They live at{' '}
            <Box component="span" sx={{ fontFamily: mono }}>
              cere/agents/&lt;name&gt;.json
            </Box>
            .
          </Typography>
        </Section>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          {defs.agents.map((a) => {
            const missing = a.def ? missingSecrets(a.def, secrets.data) : [];
            return (
              <Box
                key={`${a.bucket}/${a.key}`}
                sx={{
                  backgroundColor: color.surface,
                  border: `1px solid ${color.border}`,
                  borderRadius: '16px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap="10px">
                  <Box minWidth={0}>
                    <Box
                      component={NavLink}
                      to={agentPath(a.bucket, a.name)}
                      sx={{
                        fontSize: 17,
                        fontWeight: 700,
                        color: color.text,
                        textDecoration: 'none',
                        '&:hover': { color: color.primary },
                      }}
                    >
                      {a.name}
                    </Box>
                    <Typography
                      sx={{ fontFamily: mono, fontSize: 12, color: color.textTertiary }}
                      title={`${a.bucket}/${a.key}`}
                    >
                      {a.bucket}
                    </Typography>
                  </Box>
                  {a.def && <Pill tone="primary">{a.def.harness}</Pill>}
                </Stack>
                {a.def ? (
                  <>
                    {a.def.description && <Typography sx={text.secondary}>{a.def.description}</Typography>}
                    <Typography sx={{ ...text.caption, fontFamily: mono }}>
                      {shortImage(a.def.image)} · {a.def.model.model}
                    </Typography>
                    <Stack direction="row" gap="6px" flexWrap="wrap">
                      {(a.def.egress?.allow ?? []).map((r, i) => (
                        <Stack key={i} direction="row" alignItems="center" gap="4px">
                          <Box component="span" sx={{ ...text.caption, fontFamily: mono }}>
                            {r.host}
                          </Box>
                          {r.credential && <CredentialChip name={r.credential} />}
                        </Stack>
                      ))}
                    </Stack>
                    {missing.length > 0 && (
                      <Typography sx={{ ...text.caption, color: color.warning }}>
                        Needs the secret{missing.length > 1 ? 's' : ''}{' '}
                        {missing.map((n, i) => (
                          <span key={n}>
                            {i > 0 && ', '}
                            <NavLink to={addSecretPath(n)}>{n}</NavLink>
                            {n === a.def!.model.credential && ' (the model’s key)'}
                          </span>
                        ))}
                        . Open the agent for what {missing.length > 1 ? 'each is' : 'it is'} and where to get it.
                      </Typography>
                    )}
                  </>
                ) : (
                  <Typography sx={{ ...text.caption, color: color.warning }}>{a.errors.join(' ')}</Typography>
                )}
                <Stack direction="row" justifyContent="flex-end" gap="8px" marginTop="auto" paddingTop="6px">
                  <Button
                    size="small"
                    variant={a.def ? 'contained' : 'outlined'}
                    color={a.def ? 'primary' : 'secondary'}
                    component={NavLink}
                    to={agentPath(a.bucket, a.name)}
                  >
                    {a.def ? 'Open and run' : 'Open'}
                  </Button>
                </Stack>
              </Box>
            );
          })}
        </Box>
      )}

      <Box
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(0, 1fr)' }, gap: '16px' }}
      >
        <Section
          title="Recent runs"
          flush
          actions={
            <Button component={NavLink} to="/agents/runs" variant="text" color="secondary" size="small">
              All runs
            </Button>
          }
        >
          {runs.error && !runs.data ? (
            <Box padding="0 22px 18px">
              <ReadError what="runs" error={runs.error} />
            </Box>
          ) : (
            <RunsTable rows={rows.slice(0, 8)} empty={runs.data ? 'No runs yet.' : 'Reading…'} />
          )}
        </Section>
        <Section title="From a terminal">
          <Typography sx={{ ...text.secondary, marginTop: '-6px', marginBottom: '12px' }}>
            The CLI runs the same definitions the same way: a sandbox per run, with the same labels, so its runs show
            here too. The examples (<Mono>research.json</Mono>, <Mono>sre.json</Mono>, <Mono>langgraph.json</Mono>) are
            assets of the CLI’s release, and a local file needs no bucket.
          </Typography>
          <CodeBlock code={FROM_A_TERMINAL} />
          <Typography sx={{ ...text.caption, marginTop: '10px' }}>
            Their model is <Mono>glm-5.3</Mono> on devnet’s inference gateway, the cluster your sandboxes run on, with
            the secret <NavLink to={addSecretPath(MODEL_KEY_SECRET)}>{MODEL_KEY_SECRET}</NavLink>: your own bucket’s
            COMPUTE token, which that gateway takes as the model key and bills to the same bucket. From a terminal,{' '}
            <Mono>cere secret set {MODEL_KEY_SECRET} --from-login</Mono> stores the token the CLI logged in with; the
            button below stores this console’s. Either stops working when its token expires. <Mono>sre.json</Mono> also
            needs <NavLink to={addSecretPath('github-readonly')}>github-readonly</NavLink>: a GitHub fine-grained
            personal access token with read-only access (
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
              github.com/settings/personal-access-tokens/new
            </a>
            ). <Mono>cere agent push -f research.json</Mono> keeps a definition in a storage bucket (with the S3
            credential from CLI access), and then <Mono>cere agent run research</Mono> finds it by name.
          </Typography>
          <Stack gap="8px" marginTop="14px">
            <Typography sx={text.secondary}>
              {secrets.error && !secrets.data ? (
                <>Couldn’t read your secrets: {secrets.error}</>
              ) : !secrets.data ? (
                'Reading your secrets…'
              ) : modelKey ? (
                <>
                  This bucket holds <Mono>{MODEL_KEY_SECRET}</Mono>, updated{' '}
                  <span title={modelKey.updated_at}>{fmtAgo(modelKey.updated_at)}</span>.
                </>
              ) : (
                <>
                  This bucket has no <Mono>{MODEL_KEY_SECRET}</Mono> yet.
                </>
              )}
            </Typography>
            {examplesOnConsoleGateway ? (
              <TokenSecretButton held={modelKey} onStored={secrets.reload} />
            ) : (
              <Typography sx={text.caption}>
                This console’s inference gateway (<Mono>{inferenceConfig.gatewayUrl}</Mono>) is not the examples’ one,
                so its token is not their key: add a key of their gateway under{' '}
                <NavLink to={addSecretPath(MODEL_KEY_SECRET)}>Secrets</NavLink>.
              </Typography>
            )}
          </Stack>
        </Section>
      </Box>

      {adding && (
        <AddDefinitionDialog
          existing={defs.agents}
          onClose={(s) => {
            setAdding(false);
            if (s) {
              setSaved(`Saved ${s.name} to ${s.bucket}.`);
              defs.reload();
            }
          }}
        />
      )}
    </Box>
  );
};

export default observer(Overview);
