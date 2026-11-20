import {
  Box,
  Typography,
  Stack,
  Button,
  LoadingButton,
  TextField,
  MenuItem,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  styled,
} from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';

import { useAccount } from '~/hooks';
import { useModels, useOwnerBuckets } from '~/inference/useInference';
import { chatModelChoices, exampleModels } from '~/inference/model';
import { rememberKey, useSessionKey } from '~/inference/sessionKey';
import { SNIPPET_TABS, snippetsFor, providerFields, type SnippetTabId } from '~/inference/snippets';
import { Section } from '~/components';
import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import '~/inference/inference.css';

/**
 * Inference → Quickstart: one page, three steps. Create a key right here (the
 * SSCP wallet signs it), copy it once, then copy an example that already carries
 * the key, the gateway base URL and a live model id. Opened from the Models
 * page ("Get started"), the API keys page, and the Usage empty state.
 */
const TTL_DAYS = [7, 30, 90];
const DAY_MS = 24 * 60 * 60 * 1000;

const Code = styled('pre')({
  margin: 0,
  padding: '12px 14px',
  paddingRight: 84,
  borderRadius: 8,
  backgroundColor: 'var(--i-code-bg, #0f1729)',
  color: 'var(--i-code-tx, #e2e8f0)',
  font: '12.5px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  overflowX: 'auto',
  whiteSpace: 'pre',
});

const Mono = styled(Box)(({ theme }) => ({
  font: '13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
  wordBreak: 'break-all',
  padding: '12px 14px',
  borderRadius: 8,
  backgroundColor: '#fff',
  border: `1px solid ${theme.palette.divider}`,
}));

const TabButton = styled('button', { shouldForwardProp: (p) => p !== 'active' })<{ active: boolean }>(
  ({ theme, active }) => ({
    appearance: 'none',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    padding: theme.spacing(1, 0),
    marginRight: theme.spacing(2.5),
    font: '600 14px/1 inherit',
    whiteSpace: 'nowrap',
    color: active ? theme.palette.primary.main : theme.palette.text.secondary,
    borderBottom: `2px solid ${active ? theme.palette.primary.main : 'transparent'}`,
  }),
);

const StepNo = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  font: '600 12px/1 inherit',
  flexShrink: 0,
}));

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        /* clipboard blocked; the text is selectable */
      });
  };
  return [copied, copy];
}

function CopyButton({ text, label = 'Copy', dark }: { text: string; label?: string; dark?: boolean }) {
  const [copied, copy] = useCopy();
  return (
    <Button
      size="small"
      variant="outlined"
      color="secondary"
      onClick={() => copy(text)}
      sx={dark ? { backgroundColor: '#fff', '&:hover': { backgroundColor: '#fff' } } : { flexShrink: 0 }}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <Box position="relative">
      <Box position="absolute" top={8} right={8}>
        <CopyButton text={text} dark />
      </Box>
      <Code>{text}</Code>
    </Box>
  );
}

function StepTitle({ no, title, done }: { no: number; title: string; done?: boolean }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" marginBottom="12px">
      <StepNo>{done ? '✓' : no}</StepNo>
      <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{title}</Typography>
    </Stack>
  );
}

function Problem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2">{title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
    </Box>
  );
}

function CommonProblems() {
  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{ border: (t) => `1px solid ${t.palette.divider}`, borderRadius: '8px', '&:before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<span aria-hidden>▾</span>}>
        <Typography variant="subtitle2">Common problems</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>
          <Problem title="Claude Code ignores the settings">
            Variables in <code>~/.zshrc</code> or <code>~/.bashrc</code> aren’t seen when Claude Code is started from an
            IDE. Use <code>~/.claude/settings.json</code> instead, or check from the same terminal with{' '}
            <code>echo $ANTHROPIC_BASE_URL</code>.
          </Problem>
          <Problem title="401 Unauthorized">
            The key has expired or was copied incompletely. Create a new key above and paste it again.
          </Problem>
          <Problem title="429 Too Many Requests">
            You hit your plan’s limit on requests running at the same time. Wait for running requests to finish, or send
            fewer in parallel.
          </Problem>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

const QuickstartBody = () => {
  const account = useAccount();
  const owner = account.account ?? null;
  const { buckets, loading: bucketsLoading, error: bucketsError } = useOwnerBuckets();
  const { cards, loading: modelsLoading } = useModels();
  const sessionKey = useSessionKey(owner);

  const [ttlDays, setTtlDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The key the examples use: created here, or the session's key on request. */
  const [key, setKey] = useState<{ token: string; expiresAt: number } | null>(null);
  const [tab, setTab] = useState<SnippetTabId>('curl');
  const [model, setModel] = useState<string>('');

  const choices = useMemo(() => chatModelChoices(cards), [cards]);
  const speechModel = useMemo(() => exampleModels(cards).speech, [cards]);
  useEffect(() => {
    if (!model && choices.length > 0) setModel(choices[0]);
  }, [choices, model]);

  // A different wallet invalidates a key signed by the previous one.
  useEffect(() => setKey(null), [owner]);

  const bucketId = buckets[0]?.id ?? '';

  const create = async () => {
    if (!bucketId || !owner) return;
    setBusy(true);
    setError(null);
    try {
      const ttlMs = ttlDays * DAY_MS;
      const token = await account.createInferenceApiKey(BigInt(bucketId), ttlMs);
      const created = { token, expiresAt: Date.now() + ttlMs };
      rememberKey({ ...created, account: owner });
      setKey(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const input = { apiKey: key?.token, model, speechModel };
  const blocks = snippetsFor(tab, input);
  const offerSessionKey = !!sessionKey && sessionKey.token !== key?.token;

  return (
    <Box>
      <Stack spacing="20px">
        {/* 1 — Create a key */}
        <Section>
          <StepTitle no={1} title="Create a key" done={!!key} />
          {bucketsError ? (
            <Alert severity="error">{bucketsError}</Alert>
          ) : !owner ? (
            <Typography variant="body2" color="text.secondary">
              Sign in to create a key.
            </Typography>
          ) : bucketsLoading && buckets.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Preparing…
            </Typography>
          ) : buckets.length === 0 ? (
            <Alert
              severity="info"
              action={
                <Button component={NavLink} to="/content-storage" size="small">
                  Storage
                </Button>
              }
            >
              Usage is billed to one of your storage buckets. Create a bucket first, then come back here.
            </Alert>
          ) : (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                <TextField
                  select
                  label="Expires in"
                  value={String(ttlDays)}
                  onChange={(e) => setTtlDays(Number(e.target.value))}
                  size="small"
                  sx={{ minWidth: 140 }}
                >
                  {TTL_DAYS.map((d) => (
                    <MenuItem key={d} value={String(d)}>
                      {d} days
                    </MenuItem>
                  ))}
                </TextField>
                <LoadingButton loading={busy} onClick={create}>
                  {key ? 'Create another key' : 'Create key'}
                </LoadingButton>
                <Typography variant="body2" color="text.secondary">
                  Your SSCP wallet asks you to approve it.
                </Typography>
              </Stack>
              {offerSessionKey && (
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    onClick={() => setKey({ token: sessionKey.token, expiresAt: sessionKey.expiresAt })}
                  >
                    Use the key you just created
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    Created earlier in this session · expires {fmtDate(sessionKey.expiresAt)}
                  </Typography>
                </Stack>
              )}
            </Stack>
          )}
          {error && (
            <Alert severity="error" sx={{ marginTop: '16px' }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Section>

        {/* 2 — Copy it */}
        <Section>
          <StepTitle no={2} title="Copy it" />
          {key ? (
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Mono flex={1} minWidth={0}>
                  {key.token}
                </Mono>
                <CopyButton text={key.token} label="Copy key" />
              </Stack>
              <Alert severity="warning" sx={{ marginTop: '12px' }}>
                Copy it now: <strong>you won’t see it again</strong> after you leave this page. It works until{' '}
                {fmtDate(key.expiresAt)} and can’t be revoked, so keep it private.
              </Alert>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Your key appears here once, right after you create it.
            </Typography>
          )}
        </Section>

        {/* 3 — Call a model */}
        <Section>
          <StepTitle no={3} title="Call a model" />
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap marginBottom="12px">
            <TextField
              select
              label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              size="small"
              sx={{ minWidth: 220 }}
              disabled={choices.length === 0}
              helperText={
                choices.length === 0 ? (modelsLoading ? 'Loading models…' : 'No models available') : undefined
              }
            >
              {choices.map((m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </TextField>
            {!key && (
              <Typography variant="body2" color="text.secondary">
                Create a key in step 1 and it’s filled in below.
              </Typography>
            )}
          </Stack>

          <Box
            display="flex"
            sx={{ overflowX: 'auto' }}
            borderBottom={(theme) => `1px solid ${theme.palette.divider}`}
            marginBottom="16px"
          >
            {SNIPPET_TABS.map((t) => (
              <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </TabButton>
            ))}
          </Box>

          {tab === 'tools' ? (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Add an <strong>OpenAI-compatible</strong> provider in your editor’s model settings and fill in:
              </Typography>
              {providerFields(input).map((f) => (
                <Stack key={f.label} direction="row" spacing={1.5} alignItems="center">
                  <Typography variant="subtitle2" sx={{ width: 80, flexShrink: 0 }}>
                    {f.label}
                  </Typography>
                  <Mono flex={1} minWidth={0} sx={{ padding: '8px 12px' }}>
                    {f.value}
                  </Mono>
                  <CopyButton text={f.value} />
                </Stack>
              ))}
            </Stack>
          ) : (
            <Stack spacing={2}>
              {tab === 'claude-code' && (
                <Typography variant="body2" color="text.secondary">
                  Point Claude Code at the gateway’s Anthropic-compatible endpoint. Restart Claude Code after changing
                  the settings.
                </Typography>
              )}
              {tab === 'speech' && (
                <Typography variant="body2" color="text.secondary">
                  Speech-to-text models take plain HTTP, not the chat SDKs.
                </Typography>
              )}
              {blocks.map((b, i) => (
                <Box key={i}>
                  {b.title && (
                    <Typography variant="subtitle2" marginBottom="6px">
                      {b.title}
                    </Typography>
                  )}
                  <CodeBlock text={b.code} />
                </Box>
              ))}
              {tab === 'claude-code' && <CommonProblems />}
            </Stack>
          )}
        </Section>
      </Stack>
    </Box>
  );
};

const QuickstartBodyObserved = observer(QuickstartBody);

/**
 * The quickstart opens as a wide dialog over Models (mockup "Show me how" is a
 * dialog): a short 3-step task keeps the user where they started. Deep link:
 * `/inference?quickstart=1`.
 */
export const QuickstartDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Box>
        <Typography sx={{ fontSize: 18, fontWeight: 700 }}>Get started</Typography>
        <Typography variant="body2" color="text.secondary">
          Create a key, copy it, and call a model from your laptop or app.
        </Typography>
      </Box>
      <IconButton aria-label="Close" onClick={onClose} size="small">
        <CloseIcon fontSize="small" />
      </IconButton>
    </DialogTitle>
    <DialogContent dividers sx={{ backgroundColor: 'background.default' }}>
      {open && <QuickstartBodyObserved />}
    </DialogContent>
  </Dialog>
);

export default QuickstartDialog;
