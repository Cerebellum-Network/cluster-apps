import { Box, Button, Stack, Typography } from '@cluster-apps/ui';
import { NavLink } from 'react-router-dom';

import type { AgentDefinition } from '~/compute/agentDefinition';
import { inferenceConfig } from '~/inference/inferenceConfig';
import { color, text } from '~/theme/tokens';
import { Mono } from '../../Sandboxes/components/ui';
import TokenSecretButton from '../../Sandboxes/components/TokenSecretButton';
import { useCredentialDialogs } from '../../Sandboxes/components/credentials/CredentialDialogs';
import { secretPurpose } from './definition';

/** What one missing secret is for, and where its value comes from. */
const Purpose = ({ def, name }: { def: AgentDefinition; name: string }) => {
  const p = secretPurpose(def, name, inferenceConfig.gatewayUrl);
  if (p.kind === 'rule') {
    return (
      <>
        added by the egress proxy to the sandbox’s requests to <Mono>{p.hosts.join(', ')}</Mono>.{' '}
        {p.source ? (
          <>
            Its value is {p.source.what}: create one at{' '}
            <a href={p.source.url} target="_blank" rel="noreferrer">
              {p.source.url.replace(/^https:\/\//, '')}
            </a>
            .
          </>
        ) : (
          <>Its value is the credential that service gave you.</>
        )}
      </>
    );
  }
  return (
    <>
      the key for the model <Mono>{p.model}</Mono> at <Mono>{p.host}</Mono>, an inference API key for that gateway.{' '}
      {p.sameConsole ? (
        <>
          That gateway takes this console’s access token for your bucket as its key, and bills the calls to the same
          bucket: store it with the button below. For a key that lives longer, create one under{' '}
          <NavLink to="/inference/keys">Inference › API keys</NavLink> and add it here.
        </>
      ) : p.console ? (
        <>
          That gateway serves another network than this console, so the key is one of that network: sign in to{' '}
          <a href={p.console} target="_blank" rel="noreferrer">
            {p.console.replace(/^https:\/\//, '')}
          </a>{' '}
          (its SSCP wallet is separate from this one and is created the same way), have a bucket with balance there,
          create a key under Inference › API keys, then add it here.
        </>
      ) : (
        <>Use the API key that service gave you.</>
      )}
    </>
  );
};

/**
 * Why a run can't start yet: each secret the definition names that the bucket
 * lacks (the gateway refuses such a sandbox with 400 `unknown_credential`),
 * what it is for, where its value comes from, and a button that adds it. A
 * model on this console's own inference gateway also gets the button that
 * stores this console's token as its key; `onStored` reads the secrets again.
 */
const MissingSecrets = ({
  def,
  missing,
  onStored,
}: {
  def: AgentDefinition;
  missing: string[];
  onStored?: () => void;
}) => {
  const dialogs = useCredentialDialogs();
  return (
    <Stack gap="10px">
      <Typography sx={{ ...text.body, fontWeight: 600 }}>
        The run needs {missing.length > 1 ? 'secrets' : 'a secret'} this bucket doesn’t hold:
      </Typography>
      {missing.map((name) => {
        const p = secretPurpose(def, name, inferenceConfig.gatewayUrl);
        return (
          <Stack key={name} gap="8px">
            <Stack direction="row" gap="12px" alignItems="flex-start" justifyContent="space-between">
              <Typography sx={{ ...text.secondary, color: color.text }}>
                <Box component="span" sx={{ fontWeight: 600 }}>
                  <Mono>{name}</Mono>
                </Box>
                : <Purpose def={def} name={name} />
              </Typography>
              <Button
                size="small"
                variant="outlined"
                color={p.kind === 'model' && p.sameConsole ? 'secondary' : 'primary'}
                onClick={() =>
                  void dialogs.store({
                    suggested: name,
                    hosts: p.kind === 'rule' ? p.hosts : [p.host],
                    purpose:
                      p.kind === 'rule'
                        ? `For ${def.name}’s requests to ${p.hosts.join(', ')}.`
                        : `${def.name}’s key for the model ${p.model} at ${p.host}.`,
                  })
                }
                sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                {p.kind === 'model' && p.sameConsole ? 'Add another key' : `Add ${name}`}
              </Button>
            </Stack>
            {p.kind === 'model' && p.sameConsole && <TokenSecretButton name={name} onStored={onStored} />}
          </Stack>
        );
      })}
    </Stack>
  );
};

export default MissingSecrets;
