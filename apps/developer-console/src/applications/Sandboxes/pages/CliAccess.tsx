import { useState } from 'react';
import { Alert, Box, Button, LoadingButton, MenuItem, Stack, TextField, Typography } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';

import { PageHeader, Section } from '~/components';
import { useAccount } from '~/hooks';
import { useCompute } from '~/compute/ComputeProvider';
import { errorMessage } from '~/compute/client';
import { color, mono, text } from '~/theme/tokens';
import { CodeBlock, StepTitle, useCopy } from '../components/bits';
import { BucketChip } from '../components/ui';

const TTL_DAYS = [1, 7, 30];
const DAY_MS = 24 * 60 * 60 * 1000;

const fmtDate = (ms: number) => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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
            <TextField select label="Expires in" value={String(ttlDays)} onChange={(e) => setTtlDays(Number(e.target.value))} size="small" sx={{ minWidth: 140 }}>
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
            <Box marginTop="16px" padding="16px" borderRadius="12px" sx={{ backgroundColor: color.inset, border: `1px solid ${color.border}` }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" marginBottom="8px" gap="12px">
                <Typography variant="subtitle2">
                  Token for bucket {shown.bucket} · expires {fmtDate(shown.expiresAt)}
                </Typography>
                <Button size="small" variant="outlined" color="secondary" onClick={() => copy(shown.token)}>
                  {copied ? 'Copied' : 'Copy token'}
                </Button>
              </Stack>
              <Box sx={{ font: `13px/1.5 ${mono}`, wordBreak: 'break-all', padding: '12px 14px', borderRadius: '8px', backgroundColor: color.surface, border: `1px solid ${color.border}` }}>
                {shown.token}
              </Box>
              <Typography sx={{ ...text.secondary, marginTop: '10px' }}>
                <strong style={{ color: color.text }}>Shown once.</strong> It <strong style={{ color: color.text }}>can’t be revoked</strong>: anyone
                who has it can run sandboxes billed to bucket {shown.bucket} until {fmtDate(shown.expiresAt)}. Keep it in the CLI’s
                config, not in code.
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
                Paste the token when it asks. It is saved in <Box component="span" sx={{ fontFamily: mono }}>~/.config/cere/config.json</Box> (mode 0600);{' '}
                <Box component="span" sx={{ fontFamily: mono }}>cere whoami</Box> shows the bucket and the expiry. The CLI calls{' '}
                <Box component="span" sx={{ fontFamily: mono }}>{gatewayUrl}</Box>; add <Box component="span" sx={{ fontFamily: mono }}>--api-url</Box> if yours is elsewhere.
              </Typography>
            </Box>
            <Box>
              <StepTitle no={2} title="Or use it from the environment" />
              <CodeBlock code={`export CERE_TOKEN=<the token>\nexport CERE_API_URL=${gatewayUrl}`} />
              <Typography sx={{ ...text.secondary, marginTop: '8px' }}>The CLI and the Python SDK both read these, ahead of the config file.</Typography>
            </Box>
          </Stack>
        </Section>
      </Stack>
    </Box>
  );
};

export default observer(CliAccess);
