import { useState } from 'react';
import { Button, Typography } from '@cluster-apps/ui';

import { Section } from '~/components';
import { agentSecrets, sandboxUses } from '~/compute/credentials';
import { useSecrets } from '~/compute/hooks';
import { isLive, type Sandbox, type SecretSummary } from '~/compute/types';
import { text } from '~/theme/tokens';
import CredentialList from '../../Sandboxes/components/credentials/CredentialList';
import { DeleteConfirm, useCredentialDialogs } from '../../Sandboxes/components/credentials/CredentialDialogs';
import { ReadError } from '../../Sandboxes/components/ui';

/**
 * An agent's own credentials (`PUT /v1/secrets/{name}?agent=<agent>`): only
 * its runs use them, ahead of a bucket credential of the same name. Listed
 * with the header and hosts, never a value; added, stored again (a new value
 * and hosts) and deleted here.
 */
const AgentCredentials = ({ agent, runs }: { agent: string; runs: Sandbox[] }) => {
  const secrets = useSecrets();
  const dialogs = useCredentialDialogs();
  const [deleting, setDeleting] = useState<SecretSummary | null>(null);
  const mine = agentSecrets(secrets.data, agent) ?? [];
  const store = (s?: SecretSummary) =>
    void dialogs.store(
      s
        ? { name: s.name, hosts: s.hosts, header: s.header, agent }
        : { agent, purpose: `Only ${agent}’s runs use it.` },
    );

  return (
    <Section
      title="Credentials"
      actions={
        <Button size="small" variant="text" color="secondary" onClick={() => store()}>
          Add
        </Button>
      }
    >
      <Typography sx={{ ...text.secondary, marginTop: '-6px', marginBottom: '6px' }}>
        This agent’s own. Only its runs use them, ahead of the bucket’s credential of the same name.
      </Typography>
      {secrets.error && !secrets.data ? (
        <ReadError what="its credentials" error={secrets.error} />
      ) : (
        <CredentialList
          items={mine}
          empty={
            <Typography sx={text.caption}>
              {secrets.data ? 'None yet: its rules use the bucket’s credentials.' : 'Reading…'}
            </Typography>
          }
          actions={(name) => {
            const s = mine.find((x) => x.name === name);
            return s ? (
              <>
                <Button size="small" variant="text" color="secondary" onClick={() => store(s)}>
                  Replace
                </Button>
                <Button size="small" variant="text" color="error" onClick={() => setDeleting(s)}>
                  Delete
                </Button>
              </>
            ) : null;
          }}
        />
      )}
      {deleting && (
        <DeleteConfirm
          name={deleting.name}
          agent={agent}
          inUse={runs.filter((sb) => isLive(sb.status) && sandboxUses(sb, deleting, secrets.data ?? [])).length}
          onClose={() => setDeleting(null)}
        />
      )}
    </Section>
  );
};

export default AgentCredentials;
