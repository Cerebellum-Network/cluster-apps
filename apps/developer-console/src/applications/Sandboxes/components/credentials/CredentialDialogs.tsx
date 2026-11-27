import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  LoadingButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@cluster-apps/ui';
import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { useComputeClient } from '~/compute/ComputeProvider';
import { errorMessage } from '~/compute/client';
import { notifySecretsChanged, useNow, useSandboxes, useSecrets } from '~/compute/hooks';
import { fmtAgo } from '~/compute/format';
import { RESOLUTION_NOTE, sandboxUses, secretAgents } from '~/compute/credentials';
import { isLive, type SecretSummary } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { Chip } from '../../pages/SandboxList';
import { KeyGlyph, ReadError, sbColor } from '../ui';
import SecretDialog, { type SecretDialogProps } from './SecretDialog';

type AddOptions = Omit<SecretDialogProps, 'onClose'>;

/** The filter value for the bucket's own credentials. */
const BUCKET = '(bucket)';

interface CredentialDialogs {
  /** Open the credential form; resolves with the stored name, or null when it was closed without saving. */
  store: (opts?: AddOptions) => Promise<string | null>;
  /** Open the list of the bucket's credentials and its agents' (replace, delete, add); `agent` filters it to one. */
  manage: (opts?: { agent?: string }) => void;
}

const Ctx = createContext<CredentialDialogs | null>(null);

/**
 * The credential dialogs, for every page under it: the form that stores one
 * (new, or again with more hosts) and the list of the bucket's credentials.
 * Credentials are kept per bucket so sandboxes and agents can share them;
 * pages create and pick them where a rule needs one, not on a page of their own.
 */
export function CredentialDialogProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<AddOptions | null>(null);
  const [managing, setManaging] = useState<{ agent?: string } | null>(null);
  const resolve = useRef<((name: string | null) => void) | null>(null);

  const store = useCallback((opts: AddOptions = {}) => {
    resolve.current?.(null);
    setForm(opts);
    return new Promise<string | null>((r) => {
      resolve.current = r;
    });
  }, []);
  const manage = useCallback((opts?: { agent?: string }) => setManaging({ agent: opts?.agent }), []);
  const value = useMemo(() => ({ store, manage }), [store, manage]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {managing && <ManageCredentialsDialog agent={managing.agent} onClose={() => setManaging(null)} onStore={store} />}
      {form && (
        <SecretDialog
          {...form}
          onClose={(saved) => {
            setForm(null);
            resolve.current?.(saved ?? null);
            resolve.current = null;
          }}
        />
      )}
    </Ctx.Provider>
  );
}

export function useCredentialDialogs(): CredentialDialogs {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCredentialDialogs outside CredentialDialogProvider');
  return c;
}

export const DeleteConfirm = ({
  name,
  agent,
  inUse,
  onClose,
}: {
  name: string;
  /** Delete that agent's secret of this name (`?agent=`), not the bucket's. */
  agent?: string;
  inUse: number;
  onClose: (deleted?: boolean) => void;
}) => {
  const client = useComputeClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await (agent ? client.deleteSecret(name, { agent }) : client.deleteSecret(name));
      notifySecretsChanged();
      onClose(true);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={() => onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>
        Delete {name}
        {agent ? ` of ${agent}` : ''}?
      </DialogTitle>
      <DialogContent dividers>
        <Typography sx={text.body}>
          {inUse
            ? `${inUse} running sandbox${inUse === 1 ? ' uses' : 'es use'} it. Their requests that need it will fail with 502 “credential missing”.`
            : 'No running sandbox uses it.'}{' '}
          {agent
            ? `${agent}’s runs fall back to the bucket’s ${name}, if the bucket has one.`
            : 'Agent definitions that name it can’t start a run until it is stored again.'}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ marginTop: '12px' }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ padding: '14px 24px' }}>
        <Button variant="outlined" color="secondary" onClick={() => onClose()}>
          Cancel
        </Button>
        <LoadingButton variant="contained" color="error" loading={busy} onClick={go}>
          Delete
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

/**
 * The bucket's credentials and its agents' (`GET /v1/secrets`): whose each is,
 * what it is sent as, where to, and which running sandboxes use it. Filtered
 * to the bucket's or to one agent's.
 */
const ManageCredentialsDialog = ({
  agent: initialAgent,
  onClose,
  onStore,
}: {
  agent?: string;
  onClose: () => void;
  onStore: (opts?: AddOptions) => Promise<string | null>;
}) => {
  const { data, error, loading } = useSecrets();
  const sandboxes = useSandboxes({ status: 'running' });
  const now = useNow(10_000);
  const [deleting, setDeleting] = useState<SecretSummary | null>(null);
  /** '' all, BUCKET the bucket's, else an agent's. */
  const [filter, setFilter] = useState<string>(initialAgent ?? '');
  const live = (sandboxes.data?.items ?? []).filter((s) => isLive(s.status));
  const all = data ?? [];
  const usedBy = (s: SecretSummary) => live.filter((sb) => sandboxUses(sb, s, all)).length;
  const agents = secretAgents(data);
  if (filter && filter !== BUCKET && !agents.includes(filter)) agents.push(filter);
  const shown = all.filter((s) => !filter || (filter === BUCKET ? !s.agent : s.agent === filter));
  const storeOpts = filter && filter !== BUCKET ? { agent: filter } : {};

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Credentials in this bucket
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ padding: 0 }}>
        <Typography sx={{ ...text.secondary, padding: '14px 24px 6px' }}>
          Kept by the egress proxy: the bucket’s for any sandbox or agent of it, an agent’s for that agent’s runs only.
          The proxy adds the value to the requests a rule allows, and only to the hosts it is bound to; nobody can read
          it back. {RESOLUTION_NOTE}
        </Typography>
        {(agents.length > 0 || filter) && (
          <Stack direction="row" gap="6px" flexWrap="wrap" sx={{ padding: '8px 24px 10px' }}>
            <Chip active={!filter} onClick={() => setFilter('')}>
              All
            </Chip>
            <Chip active={filter === BUCKET} onClick={() => setFilter(BUCKET)}>
              The bucket’s
            </Chip>
            {agents.map((a) => (
              <Chip key={a} active={filter === a} onClick={() => setFilter(a)}>
                Agent {a}
              </Chip>
            ))}
          </Stack>
        )}
        {error && !data ? (
          <Box padding="12px 24px 18px">
            <ReadError what="your credentials" error={error} />
          </Box>
        ) : (
          <Table size="small" sx={{ '& td, & th': { verticalAlign: 'top' } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ paddingLeft: '24px' }}>Name</TableCell>
                <TableCell>Belongs to</TableCell>
                <TableCell>Sent only to</TableCell>
                <TableCell>Used by</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((s) => {
                const n = usedBy(s);
                return (
                  <TableRow key={`${s.agent ?? ''}/${s.name}`}>
                    <TableCell sx={{ paddingLeft: '24px' }}>
                      <Stack direction="row" alignItems="center" gap="8px" sx={{ color: sbColor.credential }}>
                        <KeyGlyph />
                        <Box
                          component="span"
                          sx={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: color.text }}
                        >
                          {s.name}
                        </Box>
                      </Stack>
                      <Typography sx={{ ...text.caption, whiteSpace: 'nowrap' }}>
                        as{' '}
                        <Box component="span" sx={{ fontFamily: mono }}>
                          {s.header}
                        </Box>
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                      {s.agent ? (
                        <>
                          Agent{' '}
                          <Box component="span" sx={{ fontFamily: mono, fontSize: 12.5 }}>
                            {s.agent}
                          </Box>
                        </>
                      ) : (
                        <Box component="span" sx={{ color: color.textSecondary }}>
                          The bucket
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.hosts && s.hosts.length > 0 ? (
                        <Box component="span" sx={{ fontFamily: mono, fontSize: 12.5, color: color.textSecondary }}>
                          {s.hosts.join(', ')}
                        </Box>
                      ) : (
                        <Typography sx={{ ...text.caption, color: color.warning }}>
                          nowhere: store it again with its hosts
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13, whiteSpace: 'nowrap', color: n ? color.text : color.textTertiary }}>
                      {n ? `${n} running sandbox${n === 1 ? '' : 'es'}` : 'not in use'}
                    </TableCell>
                    <TableCell
                      sx={{ fontSize: 13, whiteSpace: 'nowrap', color: color.textSecondary }}
                      title={s.updated_at}
                    >
                      {fmtAgo(s.updated_at, now)}
                    </TableCell>
                    <TableCell align="right" sx={{ paddingRight: '24px' }}>
                      <Stack direction="row" gap="6px" justifyContent="flex-end" flexWrap="nowrap">
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          sx={{ whiteSpace: 'nowrap' }}
                          onClick={() =>
                            void onStore({ name: s.name, hosts: s.hosts, header: s.header, agent: s.agent })
                          }
                        >
                          Store again
                        </Button>
                        <Button size="small" variant="text" color="error" onClick={() => setDeleting(s)}>
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: 'center', padding: '28px' }}>
                    <Typography sx={text.secondary}>
                      {filter && filter !== BUCKET ? `No credentials of ${filter} yet.` : 'No credentials yet.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        <Typography sx={{ ...text.caption, padding: '12px 24px 16px' }}>
          From a terminal:{' '}
          <Box component="span" sx={{ fontFamily: mono }}>
            cere secret set &lt;name&gt;{storeOpts.agent ? ` --agent ${storeOpts.agent}` : ''} --header Authorization
            --host &lt;host&gt; --bearer-stdin
          </Box>{' '}
          reads the value from a pipe, so it never appears in your shell history.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ padding: '14px 24px' }}>
        <Button variant="outlined" color="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="contained" onClick={() => void onStore(storeOpts)}>
          {storeOpts.agent ? `New credential for ${storeOpts.agent}` : 'New credential'}
        </Button>
      </DialogActions>
      {deleting && (
        <DeleteConfirm
          name={deleting.name}
          agent={deleting.agent}
          inUse={usedBy(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </Dialog>
  );
};
