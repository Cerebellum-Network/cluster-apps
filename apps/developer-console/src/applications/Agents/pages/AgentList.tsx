import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@cluster-apps/ui';
import { NavLink, useSearchParams } from 'react-router-dom';

import { PageHeader, Pill, Section } from '~/components';
import { useAccount } from '~/hooks';
import { useAgentDefinitions } from '~/compute/agentHooks';
import { bucketList, bucketNames } from '~/compute/agentStore';
import { useCompute } from '~/compute/ComputeProvider';
import { useSecrets } from '~/compute/hooks';
import { useCanSign } from '~/compute/walletSigning';
import { shortImage } from '~/compute/format';
import { color, mono, text } from '~/theme/tokens';
import { BucketChip, CredentialChip, ReadError } from '../../Sandboxes/components/ui';
import AddDefinitionDialog from '../components/AddDefinitionDialog';
import { agentPath, missingSecrets, NEW_AGENT_PATH } from '../components/definition';

/**
 * Agents: the definitions in every storage bucket of the wallet
 * (`cere/agents/*.json` on the DDC S3 gateway): create one with the form,
 * import a JSON file, or open one to run it, see its runs, edit it, or change
 * its network rules and credentials.
 */
const AgentList = () => {
  const account = useAccount();
  const { bucketId } = useCompute();
  const canSign = useCanSign();
  const list = bucketList(account.buckets, account.bucketsError);
  const defs = useAgentDefinitions(bucketNames(list));
  const secrets = useSecrets();
  const [params, setParams] = useSearchParams();
  const importing = params.get('import') === '1';
  const setImporting = (on: boolean) => {
    if (on) params.set('import', '1');
    else params.delete('import');
    setParams(params, { replace: !on });
  };
  const [saved, setSaved] = useState<string | null>(null);

  return (
    <Box>
      <Box marginBottom="20px">
        <PageHeader
          title="Agents"
          subtitle="Each agent is a cere.agent/v1 document in one of your storage buckets, at cere/agents/<name>.json: its harness and image, model, tools and network rules. The CLI and the SDK read the same files."
          actions={
            <>
              <BucketChip bucketId={bucketId} />
              <Button variant="outlined" color="secondary" onClick={() => setImporting(true)}>
                Import JSON
              </Button>
              <Button variant="contained" component={NavLink} to={NEW_AGENT_PATH}>
                Create agent
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

      {!canSign ? (
        <Section>
          <Typography sx={text.body}>
            Agent definitions live in your storage buckets on the DDC S3 gateway (
            <Box component="span" sx={{ fontFamily: mono }}>
              cere/agents/&lt;name&gt;.json
            </Box>
            ), which only your wallet can read, and this development view has no wallet: sign in with your SSCP wallet
            to see them. The Overview’s examples run without a bucket.
          </Typography>
        </Section>
      ) : defs.loading && defs.agents.length === 0 ? (
        <Stack direction="row" alignItems="center" gap="12px" padding="24px 0">
          <CircularProgress size={18} />
          <Typography sx={text.secondary}>Reading definitions from your buckets…</Typography>
        </Stack>
      ) : defs.error ? (
        <ReadError what="agent definitions" error={defs.error} />
      ) : list.state === 'unreadable' ? (
        <ReadError what="your storage buckets, where agent definitions live" error={list.error} />
      ) : defs.agents.length === 0 ? (
        <Section>
          <Typography sx={text.body}>
            No agent definitions in your buckets yet. Create one with the form, import a JSON file (the examples are
            assets of the CLI’s release), or push one from a terminal with{' '}
            <Box component="span" sx={{ fontFamily: mono }}>
              cere agent push -f &lt;file&gt;.json
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
                            <NavLink to={`${agentPath(a.bucket, a.name)}?tab=egress`}>{n}</NavLink>
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
                  {a.def && (
                    <Button
                      size="small"
                      variant="text"
                      color="secondary"
                      component={NavLink}
                      to={`${agentPath(a.bucket, a.name)}/edit`}
                    >
                      Edit
                    </Button>
                  )}
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

      {importing && (
        <AddDefinitionDialog
          existing={defs.agents}
          onClose={(s) => {
            setImporting(false);
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

export default observer(AgentList);
