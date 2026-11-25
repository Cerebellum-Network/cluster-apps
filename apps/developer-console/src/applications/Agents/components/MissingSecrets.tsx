import { Box, Button, Stack, Typography } from '@cluster-apps/ui';
import { NavLink } from 'react-router-dom';

import type { AgentDefinition } from '~/compute/agentDefinition';
import { inferenceConfig } from '~/inference/inferenceConfig';
import { color, text } from '~/theme/tokens';
import { Mono } from '../../Sandboxes/components/ui';
import { secretPurpose } from './definition';

/** Where Secrets opens its add dialog for `name`, ready to save. */
export const addSecretPath = (name: string) => `/sandboxes/secrets?add=${encodeURIComponent(name)}`;

/** What one missing secret is for, and where its value comes from. */
const Purpose = ({ def, name }: { def: AgentDefinition; name: string }) => {
  const p = secretPurpose(def, name, inferenceConfig.gatewayUrl);
  if (p.kind === 'rule') {
    return (
      <>
        added by the egress proxy to the sandbox’s requests to <Mono>{p.hosts.join(', ')}</Mono>. Its value is the
        credential that service gave you.
      </>
    );
  }
  return (
    <>
      the key for the model <Mono>{p.model}</Mono> at <Mono>{p.host}</Mono>, an inference API key for that gateway.{' '}
      {p.sameConsole ? (
        <>
          Create one under <NavLink to="/inference/keys">Inference › API keys</NavLink>, then add it here.
        </>
      ) : p.console ? (
        <>
          That gateway serves another network than this console, so create the key in{' '}
          <a href={p.console} target="_blank" rel="noreferrer">
            {p.console.replace(/^https:\/\//, '')}
          </a>{' '}
          (Inference › API keys), then add it here.
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
 * what it is for, where its value comes from, and a button that adds it.
 */
const MissingSecrets = ({ def, missing }: { def: AgentDefinition; missing: string[] }) => (
  <Stack gap="10px">
    <Typography sx={{ ...text.body, fontWeight: 600 }}>
      The run needs {missing.length > 1 ? 'secrets' : 'a secret'} this bucket doesn’t hold:
    </Typography>
    {missing.map((name) => (
      <Stack key={name} direction="row" gap="12px" alignItems="flex-start" justifyContent="space-between">
        <Typography sx={{ ...text.secondary, color: color.text }}>
          <Box component="span" sx={{ fontWeight: 600 }}>
            <Mono>{name}</Mono>
          </Box>
          : <Purpose def={def} name={name} />
        </Typography>
        <Button
          size="small"
          variant="outlined"
          component={NavLink}
          to={addSecretPath(name)}
          sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          Add {name}
        </Button>
      </Stack>
    ))}
  </Stack>
);

export default MissingSecrets;
