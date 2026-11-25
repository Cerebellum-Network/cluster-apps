import { Navigate, useLocation } from 'react-router-dom';
import { Box, Logo, Stack, Typography } from '@cluster-apps/ui';
import { Button, CircularProgress } from '@mui/material';

import { color, hairline, text } from '~/components/ui';
import { shortKey } from '~/format';
import { useSession } from '~/session/SessionProvider';
import { useWalletSignIn, type SignInPhase } from '~/session/useWalletSignIn';

/**
 * Sign-in in one step: one button connects the SSCP wallet and signs the
 * console backend's challenge; the backend reads the role from the blockchain.
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

const PHASE: Record<Exclude<SignInPhase, 'idle' | 'needs-click'>, string> = {
  wallet: 'Confirm with your passkey in the wallet…',
  signing: 'Signing you in…',
  checking: 'Checking your role on the blockchain…',
};

function SignIn() {
  const s = useWalletSignIn();
  return (
    <Stack
      minHeight="100vh"
      alignItems="center"
      justifyContent="center"
      sx={{ backgroundColor: color.page, padding: 2 }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: color.surface,
          border: hairline,
          borderRadius: '16px',
          padding: { xs: '24px 20px', sm: '32px 36px 28px' },
        }}
      >
        <Logo>
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Cluster Console</Typography>
          <Typography sx={{ fontSize: 12, color: color.textTertiary }}>Powered by Cere Network</Typography>
        </Logo>
        <Typography component="h1" sx={{ ...text.pageTitle, marginTop: 4 }}>
          Sign in
        </Typography>
        <Typography sx={{ ...text.secondary, marginTop: 1 }}>
          For the cluster manager. Your role is read from the blockchain when you sign in.
        </Typography>

        <Stack spacing={1.25} sx={{ marginTop: 3.5 }}>
          {s.phase === 'needs-click' ? (
            <>
              <Button variant="contained" size="large" fullWidth onClick={s.resume}>
                Continue
              </Button>
              <Typography sx={{ ...text.caption, textAlign: 'center' }}>
                The wallet needs one more click to sign you in.
              </Typography>
            </>
          ) : (
            <>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={s.start}
                disabled={s.busy || s.restoring}
                startIcon={s.busy ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {s.resumed ? `Continue as ${shortKey(s.resumed)}` : 'Sign in with SSCP wallet'}
              </Button>
              {s.resumed && !s.busy && (
                <Button variant="text" color="secondary" size="small" onClick={s.useAnother}>
                  Use another wallet
                </Button>
              )}
            </>
          )}
          <Typography role="status" aria-live="polite" sx={{ ...text.secondary, minHeight: 18, textAlign: 'center' }}>
            {s.phase !== 'idle' && s.phase !== 'needs-click' ? PHASE[s.phase] : ''}
          </Typography>
        </Stack>

        {s.error && (
          <Typography role="alert" sx={{ marginTop: 1, fontSize: 13, color: color.danger }}>
            {s.error}
          </Typography>
        )}

        <Typography
          sx={{ ...text.caption, color: color.textTertiary, marginTop: 3, paddingTop: 2, borderTop: hairline }}
        >
          Signing in has the wallet sign a one-time message, which proves you hold its key. It moves no money and sends
          no transaction.
        </Typography>
      </Box>
    </Stack>
  );
}
