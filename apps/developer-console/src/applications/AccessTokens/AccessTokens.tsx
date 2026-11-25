import { useState } from 'react';
import { Alert, Box, Button, LoadingButton, MenuItem, Stack, TextField, Typography } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';

import { PageHeader, Section } from '~/components';
import { useAccount } from '~/hooks';
import { computeConfig } from '~/compute/computeConfig';
import { errorMessage } from '~/compute/client';
import { NO_WALLET_HERE, useCanSign } from '~/compute/walletSigning';
import { useOwnerBuckets } from '~/inference/useInference';
import { storageConfig } from '~/storage/storageConfig';
import { color, mono, text } from '~/theme/tokens';
import { CodeBlock, useCopy } from '../Sandboxes/components/bits';
import { BucketChip, Mono } from '../Sandboxes/components/ui';

const TTL_DAYS = [1, 7, 30];
const DAY_MS = 24 * 60 * 60 * 1000;

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

const S3_LABEL = 'cere-cli';

/**
 * A DDC S3 gateway credential for `cere agent list|show|push|pull|delete`,
 * which keep agent definitions in one of the wallet's buckets. Its own label
 * at the gateway (never the console's cached credential); wallet-wide; lives
 * as long as its 24-hour delegation token.
 */
const BucketAccess = observer(() => {
  const account = useAccount();
  const canSign = useCanSign();
  const buckets = account.buckets?.map((b) => b.name) ?? [];
  const [bucket, setBucket] = useState('');
  const chosen = bucket || buckets[0] || '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<{ id: string; secret: string; bucket: string; expiresAt?: number } | null>(null);
  const [copied, copy] = useCopy();

  const create = async () => {
    setBusy(true);
    setError(null);
    setShown(null);
    try {
      // An empty list after a failed listing is not "no buckets": creating one
      // then would leave the wallet with a bucket it did not ask for.
      if (!chosen && account.bucketsError) {
        throw new Error(`Couldn’t list your buckets (${account.bucketsError}), so no new one is created. Try again.`);
      }
      const target = chosen || (await account.createBucket());
      const c = await account.createS3Credential(S3_LABEL);
      setShown({ id: c.accessKeyId, secret: c.secretAccessKey, bucket: target, expiresAt: c.expiresAt });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Agent definitions in your bucket">
      <Typography sx={{ ...text.secondary, marginTop: '-6px', marginBottom: '12px' }}>
        <Box component="span" sx={{ fontFamily: mono }}>
          cere agent push
        </Box>
        ,{' '}
        <Box component="span" sx={{ fontFamily: mono }}>
          list
        </Box>{' '}
        and{' '}
        <Box component="span" sx={{ fontFamily: mono }}>
          pull
        </Box>{' '}
        keep definitions at{' '}
        <Box component="span" sx={{ fontFamily: mono }}>
          cere/agents/&lt;name&gt;.json
        </Box>{' '}
        in a bucket, through the DDC S3 gateway. They need an S3 credential of their own.
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        {buckets.length > 0 && (
          <TextField
            select
            label="Bucket"
            value={chosen}
            onChange={(e) => setBucket(e.target.value)}
            size="small"
            sx={{ minWidth: 220 }}
          >
            {buckets.map((b) => (
              <MenuItem key={b} value={b}>
                <Box component="span" sx={{ fontFamily: mono, fontSize: 13 }}>
                  {b}
                </Box>
              </MenuItem>
            ))}
          </TextField>
        )}
        <LoadingButton variant="contained" loading={busy} onClick={create} disabled={!canSign}>
          Create S3 credential
        </LoadingButton>
        <Typography sx={text.secondary}>
          {!canSign
            ? NO_WALLET_HERE
            : buckets.length
              ? 'Your SSCP wallet asks you to approve it.'
              : 'Creates a bucket first; your SSCP wallet asks you to approve both.'}
        </Typography>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ marginTop: '16px' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {shown && (
        <Box
          marginTop="16px"
          padding="16px"
          borderRadius="12px"
          sx={{ backgroundColor: color.inset, border: `1px solid ${color.border}` }}
        >
          <Stack spacing="10px">
            <Typography variant="subtitle2">
              Access key ID{' '}
              <Box component="span" sx={{ fontFamily: mono, fontWeight: 400 }}>
                {shown.id}
              </Box>
              {shown.expiresAt ? ` · expires ${fmtDate(shown.expiresAt)}` : ''}
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap="12px">
              <Box
                sx={{
                  font: `13px/1.5 ${mono}`,
                  wordBreak: 'break-all',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: color.surface,
                  border: `1px solid ${color.border}`,
                  flex: 1,
                }}
              >
                {shown.secret}
              </Box>
              <Button size="small" variant="outlined" color="secondary" onClick={() => copy(shown.secret)}>
                {copied ? 'Copied' : 'Copy secret'}
              </Button>
            </Stack>
            <Typography sx={text.secondary}>
              <strong style={{ color: color.text }}>Shown once.</strong> Copy the secret, then pipe it in so it never
              lands in your shell history:
            </Typography>
            <CodeBlock
              code={`pbpaste | cere login --s3-access-key-id ${shown.id} --s3-bucket ${shown.bucket} \\\n  --s3-endpoint ${storageConfig.ddcS3GatewayUrl} --s3-secret-stdin`}
            />
            <Typography sx={text.caption}>
              On Linux use{' '}
              <Box component="span" sx={{ fontFamily: mono }}>
                xclip -o -selection clipboard
              </Box>{' '}
              (or a file) instead of{' '}
              <Box component="span" sx={{ fontFamily: mono }}>
                pbpaste
              </Box>
              . The credential works for every bucket of this wallet until it expires.
            </Typography>
          </Stack>
        </Box>
      )}
    </Section>
  );
});

/**
 * Access tokens: what a machine without a browser uses. On your own computer
 * `cere login` signs the CLI in through this console (a grant bound to the
 * CLI's key, approved at /cli/authorize). For CI, a COMPUTE token for the
 * bucket, signed by the wallet and shown once, read with `--token-stdin`; it
 * cannot be revoked, only expire. And an S3 credential for the CLI's agent
 * definitions in a storage bucket.
 */
const AccessTokens = () => {
  const account = useAccount();
  const canSign = useCanSign();
  const owner = useOwnerBuckets();
  const bucketId = owner.buckets[0] ? String(owner.buckets[0].id) : null;
  const gatewayUrl = computeConfig.gatewayUrl;
  const [ttlDays, setTtlDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<{ token: string; expiresAt: number; bucket: string } | null>(null);
  const [copied, copy] = useCopy();

  const create = async () => {
    setBusy(true);
    setError(null);
    setShown(null);
    try {
      const bucket = bucketId ?? (await owner.ensureBucket());
      const ttlMs = ttlDays * DAY_MS;
      const token = await account.createInferenceApiKey(BigInt(bucket), ttlMs);
      setShown({ token, expiresAt: Date.now() + ttlMs, bucket });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Box marginBottom="20px">
        <PageHeader
          title="Access tokens"
          subtitle="For the cere CLI and the Python SDK where nobody can sign in through a browser, such as CI, and for agent definitions in your storage buckets."
          actions={<BucketChip bucketId={bucketId} />}
        />
      </Box>

      <Stack spacing="16px" maxWidth={860}>
        <Section title="On your own computer">
          <CodeBlock code="cere login" />
          <Typography sx={{ ...text.secondary, marginTop: '8px' }}>
            Opens this console in your browser and asks you to approve the CLI for a bucket. Your wallet signs a grant
            bound to a key the CLI made, so what reaches the CLI works only with that key. On a machine without a
            browser, <Mono>cere login --no-browser</Mono> prints the link to open elsewhere and asks for the code the
            page shows.
          </Typography>
        </Section>

        <Section title="A token for CI">
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
                  {d === 1 ? '1 day' : `${d} days`}
                </MenuItem>
              ))}
            </TextField>
            <LoadingButton variant="contained" loading={busy} onClick={create} disabled={!canSign || owner.loading}>
              Create token
            </LoadingButton>
            <Typography sx={text.secondary}>
              {canSign ? 'Your SSCP wallet asks you to approve it.' : NO_WALLET_HERE}
            </Typography>
          </Stack>
          {error && (
            <Alert severity="error" sx={{ marginTop: '16px' }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {shown && (
            <Box
              marginTop="16px"
              padding="16px"
              borderRadius="12px"
              sx={{ backgroundColor: color.inset, border: `1px solid ${color.border}` }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" marginBottom="8px" gap="12px">
                <Typography variant="subtitle2">
                  Token for bucket {shown.bucket} · expires {fmtDate(shown.expiresAt)}
                </Typography>
                <Button size="small" variant="outlined" color="secondary" onClick={() => copy(shown.token)}>
                  {copied ? 'Copied' : 'Copy token'}
                </Button>
              </Stack>
              <Box
                sx={{
                  font: `13px/1.5 ${mono}`,
                  wordBreak: 'break-all',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: color.surface,
                  border: `1px solid ${color.border}`,
                }}
              >
                {shown.token}
              </Box>
              <Typography sx={{ ...text.secondary, marginTop: '10px' }}>
                <strong style={{ color: color.text }}>Shown once.</strong> It{' '}
                <strong style={{ color: color.text }}>can’t be revoked</strong>: anyone who has it can run sandboxes
                billed to bucket {shown.bucket} until {fmtDate(shown.expiresAt)}. Keep it in your CI’s secret store.
              </Typography>
            </Box>
          )}
          <Box marginTop="16px">
            <CodeBlock code={`printenv CERE_TOKEN | cere login --token-stdin --api-url ${gatewayUrl}`} />
            <Typography sx={{ ...text.secondary, marginTop: '8px' }}>
              Or leave the CLI unconfigured: the CLI and the Python SDK both read <Mono>CERE_TOKEN</Mono> and{' '}
              <Mono>CERE_API_URL</Mono> from the environment, ahead of the config file.
            </Typography>
          </Box>
        </Section>

        <BucketAccess />
      </Stack>
    </Box>
  );
};

export default observer(AccessTokens);
