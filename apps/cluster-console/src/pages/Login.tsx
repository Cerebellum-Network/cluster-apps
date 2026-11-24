import { Navigate, useLocation } from 'react-router-dom';
import { Box, Logo, Stack, Typography } from '@cluster-apps/ui';
import { Button, CircularProgress } from '@mui/material';

import { color, text } from '~/components/ui';
import { shortKey } from '~/format';
import { useSession } from '~/session/SessionProvider';
import { useWalletSignIn } from '~/session/useWalletSignIn';

/**
 * Sign-in: connect the SSCP wallet, then sign the console backend's challenge.
 * The backend reads the account's roles from the blockchain; an account with
 * no role in this cluster is told so.
 */
export function Login() {
  const session = useSession();
  const location = useLocation();
  if (session.info) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }
  if (session.restoring) {
    return (
      <Stack minHeight="100vh" alignItems="center" justifyContent="center" spacing={1}>
        <CircularProgress size={24} />
        <Typography sx={text.secondary}>Checking your session…</Typography>
      </Stack>
    );
  }
  return <SignIn />;
}

function SignIn() {
  const s = useWalletSignIn();
  const step = s.account ? 'challenge' : 'wallet';
  return (
    <Stack
      minHeight="100vh"
      alignItems="center"
      justifyContent="center"
      sx={{ backgroundColor: color.page, padding: 3 }}
    >
      <Box
        sx={{
          width: 460,
          backgroundColor: color.surface,
          border: `1px solid ${color.border}`,
          borderRadius: '16px',
          padding: '28px 32px',
        }}
      >
        <Logo>
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Cluster Console</Typography>
          <Typography sx={{ fontSize: 12, color: color.textTertiary }}>Powered by Cere Network</Typography>
        </Logo>
        <Typography sx={{ ...text.pageTitle, marginTop: 3 }}>Sign in</Typography>
        <Typography sx={{ ...text.secondary, marginTop: 1 }}>
          For the cluster manager and node providers. Your role is read from the blockchain each time you sign in.
        </Typography>

        <Stack spacing={1.5} sx={{ marginTop: 3 }}>
          <Step
            n={1}
            done={step === 'challenge'}
            title="Connect your SSCP wallet"
            sub={s.account ? `Account ${shortKey(s.account)}` : 'Passkey sign-in at the wallet'}
          >
            {step === 'wallet' && (
              <Button variant="contained" fullWidth onClick={s.connect} disabled={s.busy}>
                {s.busy ? 'Waiting for the wallet…' : 'Connect SSCP wallet'}
              </Button>
            )}
          </Step>
          <Step
            n={2}
            done={false}
            title="Sign the cluster challenge"
            sub="Proves you hold the account. It moves no money and signs no transaction."
          >
            {step === 'challenge' && (
              <Stack direction="row" spacing={1}>
                <Button variant="contained" fullWidth onClick={s.sign} disabled={s.signing}>
                  {s.signing ? 'Signing…' : 'Sign and continue'}
                </Button>
                <Button variant="text" color="secondary" onClick={s.useAnother} disabled={s.signing}>
                  Use another wallet
                </Button>
              </Stack>
            )}
          </Step>
        </Stack>

        {s.error && (
          <Typography role="alert" sx={{ marginTop: 2, fontSize: 13, color: color.danger }}>
            {s.error}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

function Step({
  n,
  title,
  sub,
  done,
  children,
}: {
  n: number;
  title: string;
  sub: string;
  done: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Box sx={{ border: `1px solid ${color.border}`, borderRadius: '12px', padding: '12px 14px' }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            flexShrink: 0,
            backgroundColor: done ? color.success : color.primaryTint,
            color: done ? '#fff' : color.primaryDark,
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {done ? '✓' : n}
        </Box>
        <Box flex={1} minWidth={0}>
          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{title}</Typography>
          <Typography sx={{ ...text.caption, marginTop: '2px' }}>{sub}</Typography>
          {children && <Box sx={{ marginTop: 1.25 }}>{children}</Box>}
        </Box>
      </Stack>
    </Box>
  );
}
