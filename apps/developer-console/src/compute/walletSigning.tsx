/**
 * The console's development view (`?account=<hex>` on a local `npm run start`,
 * never in a built console; src/wallet/session.tsx) shows an account without
 * its wallet. Pages read with the COMPUTE token this browser already holds for
 * the account's bucket, but nothing can be signed: no new token, no S3
 * credential, no bucket listing or write through the DDC S3 gateway. These
 * pieces let the pages say so instead of failing with "not signed in".
 */
import { Alert, Box } from '@cluster-apps/ui';

import { useSession } from '~/wallet/session';
import { mono } from '~/theme/tokens';

/** Whether this page can ask the wallet to sign. */
export function useCanSign(): boolean {
  return !useSession().devView;
}

/** Why a signing action is off in the development view. */
export const NO_WALLET_HERE =
  'This development view has no wallet to sign with. Sign in with your SSCP wallet (open the console without ?account=) to do this.';

/** Shown on top of the Sandboxes and Agents pages in the development view. */
export const DevViewBanner = () => {
  const session = useSession();
  if (!session.devView) return null;
  return (
    <Alert severity="info" sx={{ marginBottom: '16px' }}>
      Development view of account{' '}
      <Box component="span" sx={{ fontFamily: mono }}>
        {session.account}
      </Box>{' '}
      (the{' '}
      <Box component="span" sx={{ fontFamily: mono }}>
        ?account=
      </Box>{' '}
      parameter of a local{' '}
      <Box component="span" sx={{ fontFamily: mono }}>
        npm run start
      </Box>
      ). There is no wallet here: pages read with the access token this browser already holds for the account’s bucket,
      and anything that needs a wallet signature (a new token, an S3 credential, agent definitions in your storage
      buckets) is turned off. Sign in with your SSCP wallet for those.
    </Alert>
  );
};
