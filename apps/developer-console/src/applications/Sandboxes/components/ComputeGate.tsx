import { ReactNode, useState } from 'react';
import { Alert, Box, Button, CircularProgress, LoadingButton, Stack, Typography } from '@cluster-apps/ui';

import { PageHeader, Section } from '~/components';
import { useCompute } from '~/compute/ComputeProvider';
import { errorMessage } from '~/compute/client';
import { text } from '~/theme/tokens';

const Waiting = ({ children }: { children: ReactNode }) => (
  <Stack direction="row" alignItems="center" gap="12px" padding="8px 0">
    <CircularProgress size={18} />
    <Typography sx={text.secondary}>{children}</Typography>
  </Stack>
);

/**
 * Renders the page once the console can call the compute gateway: a bucket to
 * bill and a COMPUTE token for it. Until then, says what it is waiting for and
 * offers the one action that unblocks it.
 */
const ComputeGate = ({ children, title }: { children: ReactNode; title?: string }) => {
  const c = useCompute();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (c.status === 'ready') return <>{children}</>;

  const setUp = async () => {
    setBusy(true);
    setErr(null);
    try {
      await c.ensureBucket();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box maxWidth={720}>
      {title && (
        <Box marginBottom="20px">
          <PageHeader title={title} />
        </Box>
      )}
      <Section
        title={
          c.status === 'no-bucket'
            ? 'Set up billing'
            : c.status === 'not-configured'
              ? 'Sandboxes are not available here'
              : 'Connecting to the compute gateway'
        }
      >
        {c.status === 'buckets-loading' && <Waiting>Reading your buckets…</Waiting>}
        {c.status === 'minting' && (
          <Waiting>
            Approve access in your SSCP wallet. It signs a 24-hour access token for bucket {c.bucketId}.
          </Waiting>
        )}
        {c.status === 'no-bucket' && (
          <Stack spacing="12px" alignItems="flex-start">
            <Typography sx={text.body}>
              Sandboxes and agent runs bill to a bucket you own on {c.network}, and you have none yet. The console makes
              one for you.
            </Typography>
            <LoadingButton variant="contained" loading={busy} onClick={setUp}>
              Set up billing
            </LoadingButton>
            <Typography sx={text.secondary}>Your SSCP wallet asks you to approve it.</Typography>
            {err && <Alert severity="error">{err}</Alert>}
          </Stack>
        )}
        {(c.status === 'token-error' || c.status === 'buckets-error' || c.status === 'not-configured') && c.error && (
          <Stack spacing="12px" alignItems="flex-start">
            <Alert severity="error" sx={{ width: '100%' }}>
              <Box title={c.error.detail}>{c.error.message}</Box>
              {c.error.detail && <Typography sx={{ ...text.caption, marginTop: '4px' }}>{c.error.detail}</Typography>}
            </Alert>
            {c.status === 'token-error' && (
              <Button variant="contained" onClick={c.retry}>
                Try again
              </Button>
            )}
          </Stack>
        )}
      </Section>
    </Box>
  );
};

export default ComputeGate;
