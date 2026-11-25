import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, Box, LoadingButton, MenuItem, TextField, Typography } from '@cluster-apps/ui';

import { useAccount } from '~/hooks';
import { bucketList, type BucketList } from '~/compute/agentStore';
import { errorMessage } from '~/compute/client';
import { useCompute } from '~/compute/ComputeProvider';
import { NO_WALLET_HERE, useCanSign } from '~/compute/walletSigning';
import { mono, text } from '~/theme/tokens';

export interface StorageBucketChoice {
  list: BucketList;
  buckets: string[];
  /** The chosen bucket, or the first one; '' when there is none. */
  bucket: string;
  setBucket: (name: string) => void;
}

/** The wallet's storage buckets on the DDC S3 gateway, where definitions are kept, and the one chosen. */
export function useStorageBucket(): StorageBucketChoice {
  const account = useAccount();
  const list = bucketList(account.buckets, account.bucketsError);
  const buckets = list.state === 'ok' || list.state === 'stale' ? list.names : [];
  const [chosen, setBucket] = useState('');
  return { list, buckets, bucket: chosen || buckets[0] || '', setBucket };
}

/**
 * Where a definition is saved: one of the wallet's storage buckets (the DDC S3
 * gateway's, named), at `cere/agents/<name>.json`, the same place
 * `cere agent push` writes it; not the numbered compute bucket the sandboxes
 * are metered to. A bucket list that could not be read is not "no bucket": it
 * offers a retry, never a new bucket. `fixed` shows the bucket a definition
 * being edited is in.
 */
const StorageBucketField = ({ choice, fixed }: { choice: StorageBucketChoice; fixed?: string }) => {
  const account = useAccount();
  const { bucketId } = useCompute();
  const canSign = useCanSign();
  const [retrying, setRetrying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { list, buckets, bucket, setBucket } = choice;

  const retry = async () => {
    setRetrying(true);
    try {
      await account.refreshBuckets();
    } finally {
      setRetrying(false);
    }
  };

  const createBucket = async () => {
    setCreating(true);
    setError(null);
    try {
      setBucket(await account.createBucket());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  if (fixed)
    return (
      <Typography sx={text.secondary}>
        Saved in storage bucket{' '}
        <Box component="span" sx={{ fontFamily: mono }}>
          {fixed}
        </Box>
        , replacing the definition there.
      </Typography>
    );
  if (!canSign)
    return (
      <Alert severity="info">
        Definitions are kept in your storage buckets on the DDC S3 gateway, which only your wallet can read and write.{' '}
        {NO_WALLET_HERE}
      </Alert>
    );
  if (list.state === 'loading') return <Typography sx={text.secondary}>Reading your storage buckets…</Typography>;
  if (list.state === 'unreadable')
    return (
      <Alert
        severity="error"
        action={
          <LoadingButton size="small" loading={retrying} onClick={retry}>
            Try again
          </LoadingButton>
        }
      >
        Couldn’t list your storage buckets ({list.error}), so the console can’t tell whether you have one. Nothing is
        created until it can.
      </Alert>
    );
  if (buckets.length)
    return (
      <TextField
        select
        label="Storage bucket"
        value={bucket}
        onChange={(e) => setBucket(e.target.value)}
        size="small"
        fullWidth
        helperText={
          list.state === 'stale'
            ? `Saved at cere/agents/<name>.json in this bucket. The list may be out of date: ${list.error}`
            : 'Saved at cere/agents/<name>.json in this bucket, on the DDC S3 gateway.'
        }
      >
        {buckets.map((b) => (
          <MenuItem key={b} value={b}>
            <Box component="span" sx={{ fontFamily: mono, fontSize: 13 }}>
              {b}
            </Box>
          </MenuItem>
        ))}
      </TextField>
    );
  return (
    <>
      <Alert
        severity="info"
        action={
          <LoadingButton size="small" loading={creating} onClick={createBucket}>
            Create one
          </LoadingButton>
        }
      >
        You have no storage bucket on the DDC S3 gateway yet. Definitions are kept in one
        {bucketId ? ` (not in compute bucket ${bucketId}, which your sandboxes are metered to)` : ''}.
      </Alert>
      {error && <Alert severity="error">{error}</Alert>}
    </>
  );
};

export default observer(StorageBucketField);
