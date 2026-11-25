import { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, Box, Button, LoadingButton, MenuItem, Stack, TextField, Typography } from '@cluster-apps/ui';
import { useSearchParams } from 'react-router-dom';

import { PageHeader, Section } from '~/components';
import { useAccount } from '~/hooks';
import { DAY_MS, GRANT_DAYS, keyFingerprint, parseCliRequest, postToCli, type GrantDays } from '~/compute/cliGrant';
import { computeConfig } from '~/compute/computeConfig';
import { errorMessage } from '~/compute/client';
import { fmtDateTime } from '~/compute/format';
import { NO_WALLET_HERE, useCanSign } from '~/compute/walletSigning';
import { useOwnerBuckets } from '~/inference/useInference';
import { color, mono, text } from '~/theme/tokens';
import { useCopy } from '~/applications/Sandboxes/components/bits';
import { Field, Mono } from '~/applications/Sandboxes/components/ui';

type Step =
  | { kind: 'asking' }
  | { kind: 'signing' }
  /** Handed to the CLI by a form POST: the CLI's own page replaces this one. */
  | { kind: 'sent' }
  /** No port (`cere login --no-browser`): the grant is shown for pasting. */
  | { kind: 'paste'; grant: string; expiresAt: number; bucket: string }
  | { kind: 'denied' };

const Code = ({ children }: { children: string }) => (
  <Box
    component="span"
    sx={{
      fontFamily: mono,
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: '0.08em',
      padding: '4px 10px',
      borderRadius: '8px',
      backgroundColor: color.inset,
      border: `1px solid ${color.border}`,
    }}
  >
    {children}
  </Box>
);

/**
 * `/cli/authorize`: where `cere login` sends the browser. It shows what the
 * CLI is asking for (a bucket, COMPUTE, a lifetime) and, on Approve, has the
 * wallet sign a grant bound to the CLI's own key, then hands it to the CLI
 * (POST to its loopback port) or shows it for pasting. Nothing is signed or
 * sent before Approve; Deny tells the CLI so.
 */
const CliAuthorize = () => {
  const [params] = useSearchParams();
  const parsed = useMemo(() => parseCliRequest(params), [params]);
  const account = useAccount();
  const canSign = useCanSign();
  const owner = useOwnerBuckets();
  const [bucketChoice, setBucketChoice] = useState('');
  const [days, setDays] = useState<GrantDays>(parsed.ok ? parsed.req.days : 7);
  const [step, setStep] = useState<Step>({ kind: 'asking' });
  const [error, setError] = useState<string | null>(null);
  const [copied, copy] = useCopy();

  if (!parsed.ok) {
    return (
      <Box maxWidth={720}>
        <PageHeader title="Sign in the cere CLI" />
        <Alert severity="error" sx={{ marginTop: '16px' }}>
          This link isn’t a sign-in request from the <Mono>cere</Mono> CLI: {parsed.error} Run <Mono>cere login</Mono>{' '}
          again and use the link it opens or prints.
        </Alert>
      </Box>
    );
  }
  const req = parsed.req;
  const buckets = owner.buckets.map((b) => String(b.id));
  const bucket = bucketChoice || buckets[0] || '';
  const expiresAt = Date.now() + days * DAY_MS;

  const approve = async () => {
    setError(null);
    setStep({ kind: 'signing' });
    try {
      const target = bucket || (await owner.ensureBucket());
      const ttl = days * DAY_MS;
      const grant = await account.createCliGrant(BigInt(target), req.key, ttl);
      if (req.port) {
        setStep({ kind: 'sent' });
        postToCli(req.port, { state: req.state, grant });
      } else {
        setStep({ kind: 'paste', grant, expiresAt: Date.now() + ttl, bucket: target });
      }
    } catch (e) {
      setError(errorMessage(e));
      setStep({ kind: 'asking' });
    }
  };

  const deny = () => {
    setStep({ kind: 'denied' });
    if (req.port) postToCli(req.port, { state: req.state, error: 'access_denied' });
  };

  if (step.kind === 'denied') {
    return (
      <Box maxWidth={720}>
        <PageHeader title="Sign in the cere CLI" />
        <Alert severity="info" sx={{ marginTop: '16px' }}>
          Denied. Nothing was signed{req.port ? ', and the CLI was told' : ''}. You can close this page.
        </Alert>
      </Box>
    );
  }

  if (step.kind === 'paste') {
    return (
      <Box maxWidth={760}>
        <PageHeader title="Sign in the cere CLI" subtitle="Approved. Paste this where the terminal asks for it." />
        <Section title="Your sign-in code">
          <Stack spacing="12px">
            <Stack direction="row" alignItems="center" gap="12px">
              <Box
                sx={{
                  font: `13px/1.5 ${mono}`,
                  wordBreak: 'break-all',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: color.inset,
                  border: `1px solid ${color.border}`,
                  flex: 1,
                }}
              >
                {step.grant}
              </Box>
              <Button variant="outlined" color="secondary" onClick={() => copy(step.grant)}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </Stack>
            <Typography sx={text.secondary}>
              It is bound to the key of the CLI that asked: it works only together with that CLI’s private key, which
              never left it. Bucket {step.bucket}, until {fmtDateTime(step.expiresAt)}.
            </Typography>
          </Stack>
        </Section>
      </Box>
    );
  }

  return (
    <Box maxWidth={760}>
      <Box marginBottom="20px">
        <PageHeader
          title="Sign in the cere CLI"
          subtitle="A cere CLI asks to use DDC compute as you. Approve only if you just ran cere login."
        />
      </Box>
      <Stack spacing="16px">
        <Section title="The request">
          <Field label="From">
            <Mono>cere</Mono>
            {req.host ? (
              <>
                {' '}
                on <Mono>{req.host}</Mono> <span style={{ color: color.textTertiary }}>(as the CLI says)</span>
              </>
            ) : null}
          </Field>
          {req.code && (
            <Field label="Code">
              <Code>{req.code}</Code>
            </Field>
          )}
          <Field label="CLI key">
            <Mono title={req.key}>{keyFingerprint(req.key)}</Mono>
          </Field>
          {req.code && (
            <Typography sx={{ ...text.secondary, marginTop: '10px' }}>
              Your terminal shows the same code. If it doesn’t, or you didn’t run <Mono>cere login</Mono>, deny.
            </Typography>
          )}
        </Section>

        <Section title="What it gets">
          <Stack spacing="16px">
            {owner.loading ? (
              <Typography sx={text.secondary}>Reading your buckets…</Typography>
            ) : owner.error ? (
              <Alert severity="error">Couldn’t read your buckets: {owner.error}</Alert>
            ) : buckets.length > 1 ? (
              <TextField
                select
                label="Bucket"
                value={bucket}
                onChange={(e) => setBucketChoice(e.target.value)}
                size="small"
                sx={{ maxWidth: 260 }}
              >
                {buckets.map((b) => (
                  <MenuItem key={b} value={b}>
                    Bucket {b}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <Typography sx={text.body}>
                {bucket ? (
                  <>
                    Bucket <strong>{bucket}</strong>, the one this console bills compute to.
                  </>
                ) : (
                  'You have no bucket yet: approving creates one first (your wallet asks for that too).'
                )}
              </Typography>
            )}
            <Typography sx={text.body}>
              <strong>Compute on that bucket</strong> (the COMPUTE operation): create and run sandboxes, store
              credentials for their egress, read their logs, egress log and usage, and call this network’s inference
              gateway. Their use is billed to the bucket. Nothing else: no storage reads or writes, no payments.
            </Typography>
            <Stack direction="row" alignItems="center" gap="14px" flexWrap="wrap">
              <TextField
                select
                label="Expires in"
                value={String(days)}
                onChange={(e) => setDays(Number(e.target.value) as GrantDays)}
                size="small"
                sx={{ minWidth: 140 }}
              >
                {GRANT_DAYS.map((d) => (
                  <MenuItem key={d} value={String(d)}>
                    {d === 1 ? '1 day' : `${d} days`}
                  </MenuItem>
                ))}
              </TextField>
              <Typography sx={text.secondary}>until {fmtDateTime(expiresAt)}. Run cere login again then.</Typography>
            </Stack>
            <Typography sx={text.secondary}>
              It is bound to this CLI’s key: what this page hands over works only together with the private key that
              stays in the CLI. It can’t be revoked one by one; it ends when it expires. The CLI calls{' '}
              <Mono>{computeConfig.gatewayUrl}</Mono>.
            </Typography>
          </Stack>
        </Section>

        {error && <Alert severity="error">Couldn’t sign it: {error}</Alert>}
        {step.kind === 'sent' && <Alert severity="success">Handing the sign-in to the CLI on this computer…</Alert>}

        <Stack direction="row" gap="12px" alignItems="center" flexWrap="wrap">
          <LoadingButton
            variant="contained"
            loading={step.kind === 'signing' || step.kind === 'sent'}
            disabled={!canSign || owner.loading || !!owner.error}
            onClick={approve}
          >
            Approve
          </LoadingButton>
          <Button variant="outlined" color="secondary" onClick={deny} disabled={step.kind !== 'asking'}>
            Deny
          </Button>
          <Typography sx={text.secondary}>
            {canSign ? 'Your SSCP wallet asks you to confirm.' : NO_WALLET_HERE}
          </Typography>
        </Stack>
        {req.port ? (
          <Typography sx={text.caption}>
            After you approve, this page hands the sign-in to the CLI at <Mono>127.0.0.1:{req.port}</Mono> on this
            computer, and the CLI’s page tells you to close the tab.
          </Typography>
        ) : (
          <Typography sx={text.caption}>
            The CLI runs without a browser (<Mono>cere login --no-browser</Mono>), so after you approve this page shows
            a code to paste into it.
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

export default observer(CliAuthorize);
