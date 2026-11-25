import { useState } from 'react';
import { Alert, LoadingButton, Stack, Typography } from '@cluster-apps/ui';

import { useCompute } from '~/compute/ComputeProvider';
import { notifySecretsChanged } from '~/compute/hooks';
import { errorMessage } from '~/compute/client';
import { fmtDateTime, fmtUtc } from '~/compute/format';
import type { SecretSummary } from '~/compute/types';
import { text } from '~/theme/tokens';
import { Mono } from './ui';

/** The bucket secret the example agents name as their model key. */
export const MODEL_KEY_SECRET = 'ddc-inference';

/**
 * Stores this console's COMPUTE token for the bucket as the secret `name`
 * (`Authorization: Bearer <token>`), write-only, through the gateway's secrets
 * API: the inference gateway of the same network takes that token as the model
 * key for this bucket. The secret stops working when the token expires, and the
 * button says when that is. `held` is the secret as the API lists it, when the
 * bucket holds one; `onStored` reads the list again after a store.
 */
const TokenSecretButton = ({
  name = MODEL_KEY_SECRET,
  held,
  onStored,
}: {
  name?: string;
  held?: SecretSummary;
  onStored?: () => void;
}) => {
  const { bucketId, storeTokenAsSecret, tokenExpiresAt } = useCompute();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The expiry of the token the last store saved, once the gateway accepted it. */
  const [storedUntil, setStoredUntil] = useState<number | null>(null);

  const store = async () => {
    if (!storeTokenAsSecret) return;
    const until = tokenExpiresAt;
    setBusy(true);
    setError(null);
    setStoredUntil(null);
    try {
      await storeTokenAsSecret(name);
      notifySecretsChanged();
      setStoredUntil(until);
      onStored?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="8px" alignItems="flex-start">
      <LoadingButton
        size="small"
        variant="outlined"
        loading={busy}
        disabled={!storeTokenAsSecret}
        onClick={store}
        sx={{ whiteSpace: 'nowrap' }}
      >
        {held ? `Replace ${name} with this console’s token` : `Store this console’s token as ${name}`}
      </LoadingButton>
      {storedUntil !== null ? (
        <Alert severity="success" onClose={() => setStoredUntil(null)}>
          Stored <Mono>{name}</Mono>: this console’s access token for compute bucket {bucketId}. It stops working when
          that token expires, <span title={fmtUtc(storedUntil)}>{fmtDateTime(storedUntil)}</span>; store it again after
          that.
        </Alert>
      ) : tokenExpiresAt !== null ? (
        <Typography sx={text.caption}>
          The token is this console’s access to compute bucket {bucketId}, good until{' '}
          <span title={fmtUtc(tokenExpiresAt)}>{fmtDateTime(tokenExpiresAt)}</span>; the secret stops working then. It
          is write-only once stored.
        </Typography>
      ) : (
        <Typography sx={text.caption}>Waiting for this console’s access to your sandboxes.</Typography>
      )}
      {error && (
        <Alert severity="error">
          Couldn’t store {name}: {error}
        </Alert>
      )}
    </Stack>
  );
};

export default TokenSecretButton;
