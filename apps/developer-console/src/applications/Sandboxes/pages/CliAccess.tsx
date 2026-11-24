import { useState } from 'react';
import { Alert, Box, Button, LoadingButton, MenuItem, Stack, TextField, Typography } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';

import { PageHeader, Section } from '~/components';
import { useAccount } from '~/hooks';
import { useCompute } from '~/compute/ComputeProvider';
import { errorMessage } from '~/compute/client';
import { storageConfig } from '~/storage/storageConfig';
import { color, mono, text } from '~/theme/tokens';
import { CodeBlock, StepTitle, useCopy } from '../components/bits';
import { BucketChip } from '../components/ui';

const TTL_DAYS = [1, 7, 30];
const DAY_MS = 24 * 60 * 60 * 1000;

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
        <LoadingButton variant="contained" loading={busy} onClick={create}>
          Create S3 credential
        </LoadingButton>
        <Typography sx={text.secondary}>
          {buckets.length
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
 * CLI access: a COMPUTE token for the `cere` CLI and the Python SDK, signed by
 * the wallet for this bucket and shown once. It is the same kind of token the
 * console itself uses, with the lifetime picked here. Stateless: it cannot be
 * revoked, only expire.
 */
const CliAccess = () => {
  const account = useAccount();
  const { bucketId, ensureBucket, gatewayUrl } = useCompute();
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
      const bucket = bucketId ?? (await ensureBucket());
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
          title="CLI access"
          subtitle="A token for the cere CLI and the Python SDK. They call the same compute gateway as this console, as your bucket."
          actions={<BucketChip bucketId={bucketId} />}
        />
      </Box>

      <Stack spacing="16px" maxWidth={860}>
        <Section title="Create a token">
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
            <LoadingButton variant="contained" loading={busy} onClick={create}>
              Create token
            </LoadingButton>
            <Typography sx={text.secondary}>Your SSCP wallet asks you to approve it.</Typography>
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
                billed to bucket {shown.bucket} until {fmtDate(shown.expiresAt)}. Keep it in the CLI’s config, not in
                code.
              </Typography>
            </Box>
          )}
        </Section>

        <Section title="Use it">
          <Stack spacing="18px">
            <Box>
              <StepTitle no={1} title="Sign the CLI in" />
              <CodeBlock code="cere login" />
              <Typography sx={{ ...text.secondary, marginTop: '8px' }}>
                Paste the token when it asks. It is saved in{' '}
                <Box component="span" sx={{ fontFamily: mono }}>
                  ~/.config/cere/config.json
                </Box>{' '}
                (mode 0600);{' '}
                <Box component="span" sx={{ fontFamily: mono }}>
                  cere whoami
                </Box>{' '}
                shows the bucket and the expiry. The CLI calls{' '}
                <Box component="span" sx={{ fontFamily: mono }}>
                  {gatewayUrl}
                </Box>
                ; add{' '}
                <Box component="span" sx={{ fontFamily: mono }}>
                  --api-url
                </Box>{' '}
                if yours is elsewhere.
              </Typography>
            </Box>
            <Box>
              <StepTitle no={2} title="Or use it from the environment" />
              <CodeBlock code={`export CERE_TOKEN=<the token>\nexport CERE_API_URL=${gatewayUrl}`} />
              <Typography sx={{ ...text.secondary, marginTop: '8px' }}>
                The CLI and the Python SDK both read these, ahead of the config file.
              </Typography>
            </Box>
          </Stack>
        </Section>

        <BucketAccess />
      </Stack>
    </Box>
  );
};

export default observer(CliAccess);
