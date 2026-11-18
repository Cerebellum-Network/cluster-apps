import {
  Box,
  Typography,
  Stack,
  Button,
  LoadingButton,
  TextField,
  MenuItem,
  Alert,
  styled,
} from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { useAccount } from '~/hooks';
import { useOwnerBuckets } from '~/inference/useInference';
import { openAiBaseUrl, anthropicBaseUrl, speechHttpUrl } from '~/inference/gateway';
import { PageHeader, Section, ComingSoon } from '~/components';
import '~/inference/inference.css';

/**
 * Inference → API keys (mockup): create a wallet-signed, shown-once COMPUTE
 * bearer; the base URLs the key plugs into; a placeholder for the key list +
 * revoke that come later. No bucket picker — the console bills the key to one of
 * the wallet's buckets behind the scenes.
 */
const TTL_DAYS = [7, 30, 90];
const DAY_MS = 24 * 60 * 60 * 1000;

const Mono = styled(Box)(({ theme }) => ({
  font: '13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
  wordBreak: 'break-all',
  padding: '12px 14px',
  borderRadius: 8,
  backgroundColor: '#fff',
  border: `1px solid ${theme.palette.divider}`,
}));

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type Shown = { token: string; expiresAt: number };

function BaseUrl({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };
  return (
    <Box flex={1} minWidth={0} padding="14px" borderRadius="10px" border={(theme) => `1px solid ${theme.palette.divider}`}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" marginBottom="8px">
        <Typography variant="subtitle2">{label}</Typography>
        <Button size="small" variant="outlined" color="secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </Stack>
      <Typography sx={{ font: '12.5px/1.5 ui-monospace, Menlo, monospace', color: 'var(--i-tx-dim)', wordBreak: 'break-all' }}>
        {url}
      </Typography>
    </Box>
  );
}

const ApiKeys = () => {
  const account = useAccount();
  const { buckets, loading: bucketsLoading, error: bucketsError } = useOwnerBuckets();

  const [ttlDays, setTtlDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [copied, setCopied] = useState(false);

  // The key bills to one of the wallet's buckets, chosen behind the scenes.
  const bucketId = buckets[0]?.id ?? '';

  const generate = async () => {
    if (!bucketId) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const ttlMs = ttlDays * DAY_MS;
      const token = await account.createInferenceApiKey(BigInt(bucketId), ttlMs);
      setShown({ token, expiresAt: Date.now() + ttlMs });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copyKey = async () => {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(shown.token);
      setCopied(true);
    } catch {
      /* clipboard blocked; the token is selectable */
    }
  };

  return (
    <Box className="inference-root">
      <Box marginBottom="20px">
        <PageHeader title="API keys" />
      </Box>

      <Stack spacing="20px">
        {/* Create */}
        <Section title="Create an API key">
        {bucketsError ? (
          <Alert severity="error">{bucketsError}</Alert>
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
            You need a storage bucket to bill inference against. Create one first.
          </Alert>
        ) : (
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
            <LoadingButton loading={busy} onClick={generate}>
              Create key
            </LoadingButton>
            <Typography variant="body2" color="text.secondary">
              Your wallet asks you to sign it.
            </Typography>
          </Stack>
        )}

        {error && (
          <Alert severity="error" sx={{ marginTop: '16px' }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {shown && (
          <Box
            marginTop="16px"
            padding="16px"
            borderRadius="10px"
            sx={{ backgroundColor: 'var(--i-chip)', border: (theme) => `1px solid ${theme.palette.divider}` }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" marginBottom="8px">
              <Typography variant="subtitle2">New key · expires {fmtDate(shown.expiresAt)}</Typography>
              <Button size="small" onClick={copyKey}>
                {copied ? 'Copied' : 'Copy key'}
              </Button>
            </Stack>
            <Mono>{shown.token}</Mono>
            <Typography variant="body2" color="text.secondary" marginTop="10px">
              <strong style={{ color: 'var(--i-tx)' }}>Shown once.</strong> It <strong style={{ color: 'var(--i-tx)' }}>can’t
              be revoked</strong>: anyone who has it can spend from your balance until {fmtDate(shown.expiresAt)}.
            </Typography>
          </Box>
        )}
        </Section>

        {/* Base URLs */}
        <Section title="Base URLs">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <BaseUrl label="OpenAI SDK" url={openAiBaseUrl()} />
          <BaseUrl label="Anthropic SDK" url={anthropicBaseUrl()} />
          <BaseUrl label="Speech models, plain HTTP" url={speechHttpUrl()} />
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block" marginTop="12px">
          The key goes where the SDK expects its API key.
        </Typography>
        </Section>

        {/* Your keys — the list + revoke come later. */}
        <Section title="Your keys" actions={<ComingSoon label="Later" />}>
          <Typography variant="body2" color="text.secondary">
            No list and no revoke yet.
          </Typography>
        </Section>
      </Stack>
    </Box>
  );
};

export default observer(ApiKeys);
