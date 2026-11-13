import { Button, LoadingButton, Stack, Typography } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { Navigate } from 'react-router-dom';
import { styled } from '@mui/material';

import { Terms } from './Login.styled';
import { DDC_CLUSTER_NAME, PRIVACY_POLICY, TERMS_AND_CONDITIONS_LINK } from '~/constants';
import { useSession } from '~/wallet/session';

const Screen = styled(Stack)(({ theme }) => ({
  minHeight: '100vh',
  justifyContent: 'center',
  alignItems: 'center',
  padding: theme.spacing(3),
}));

const Inner = styled(Stack)(({ theme }) => ({
  width: '100%',
  maxWidth: 600,
  alignItems: 'center',
  gap: theme.spacing(2),
}));

/**
 * Wallet sign-in. The old email-based Cere Wallet flow is replaced by the CEF
 * wallet (passkey) exposed through the React SessionProvider: `connect()` signs
 * in with an existing wallet, `createWallet()` registers a new one.
 */
const Login = observer(() => {
  const session = useSession();

  if (session.state === 'connected') {
    return <Navigate to="/" replace />;
  }

  const busy = session.state === 'connecting' || session.state === 'waiting';

  return (
    <Screen>
      <Inner>
        <Typography variant="h1" textAlign="center">
          Welcome to {DDC_CLUSTER_NAME}
        </Typography>
        <Typography variant="h4" textAlign="center" sx={{ mt: 2, mb: 2 }}>
          Unlock the power of the first Web3 Data Cloud for real-world applications. Sign in with your Cere wallet to get
          started.
        </Typography>

        <LoadingButton fullWidth variant="contained" size="large" loading={busy} onClick={() => session.connect()}>
          Sign in with your wallet
        </LoadingButton>
        <Button fullWidth variant="outlined" size="large" disabled={busy} onClick={() => session.createWallet()}>
          Create a new wallet
        </Button>

        {session.error && (
          <Typography color="error" variant="caption" textAlign="center">
            {session.error}
          </Typography>
        )}

        <Terms textAlign="center" variant="caption" color="secondary">
          By using your Cere wallet you automatically agree to our
          <br />{' '}
          <a href={TERMS_AND_CONDITIONS_LINK} target="_blank" rel="noopener noreferrer">
            Terms &amp; Conditions
          </a>{' '}
          and{' '}
          <a href={PRIVACY_POLICY} target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
        </Terms>
      </Inner>
    </Screen>
  );
});

export default Login;
