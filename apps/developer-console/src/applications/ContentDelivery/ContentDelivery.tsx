import { useCallback, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Box,
  Stack,
  Typography,
  Button,
  LoadingButton,
  Radio,
  TextField,
  MenuItem,
  styled,
  useMessages,
} from '@cluster-apps/ui';

import { useAccount } from '~/hooks';
import { storageConfig } from '~/storage/storageConfig';

/**
 * Content Delivery (mockup): per-bucket read access (public / private), the
 * public link, and a "Data served" chart. Access + link are wired to the tracked
 * buckets; the served-per-day chart needs the bills feed (deferred), so it shows
 * an empty state for now.
 */
type Access = 'public' | 'private';

const Card = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(3),
}));

const AccessCard = styled(Box, { shouldForwardProp: (p) => p !== 'selected' })<{ selected: boolean }>(
  ({ theme, selected }) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    borderRadius: 10,
    cursor: 'pointer',
    border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
    backgroundColor: selected ? theme.palette.action.selected : theme.palette.background.paper,
  }),
);

const ContentDelivery = () => {
  const account = useAccount();
  const { showMessage } = useMessages();
  const [isSaving, setSaving] = useState(false);
  const [bucketName, setBucketName] = useState<string>('');
  const [access, setAccess] = useState<Access>();
  const [copied, setCopied] = useState(false);

  const options = account.buckets ?? [];
  const currentBucket = options.find((b) => b.name === bucketName);
  const currentAccess: Access = access ?? (currentBucket?.isPublic ? 'public' : 'private');

  useEffect(() => {
    setAccess(undefined);
    setCopied(false);
  }, [bucketName]);

  const publicUrl = currentBucket ? `${storageConfig.ddcCdnUrl}/${currentBucket.name}` : '';

  const handleSave = useCallback(async () => {
    if (!currentBucket) return;
    setSaving(true);
    try {
      await account.saveBucket(currentBucket.name, { isPublic: currentAccess === 'public' });
      showMessage({ message: 'Bucket access has been saved', appearance: 'success' });
    } catch (e) {
      showMessage({ message: 'Could not save bucket access. Please try again.', appearance: 'error' });
      throw e;
    } finally {
      setSaving(false);
    }
  }, [account, currentBucket, currentAccess, showMessage]);

  const copyLink = () => {
    navigator.clipboard
      ?.writeText(publicUrl)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <Box>
      <Typography variant="h3" marginBottom="20px">
        Delivery
      </Typography>

      {/* Access */}
      <Card marginBottom="20px">
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} marginBottom="20px">
          <Typography variant="subtitle1">
            {currentBucket ? `Who can read bucket ${currentBucket.name}` : 'Pick a bucket to manage delivery'}
          </Typography>
          <TextField
            select
            label="Bucket"
            value={bucketName}
            onChange={(e) => setBucketName(e.target.value)}
            size="small"
            sx={{ minWidth: 240 }}
            SelectProps={{ displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
          >
            <MenuItem value="" disabled>
              Select a bucket
            </MenuItem>
            {options.length === 0 && (
              <MenuItem value="-" disabled>
                No buckets
              </MenuItem>
            )}
            {options.map((b) => (
              <MenuItem key={b.name} value={b.name}>
                {b.name} · {b.isPublic ? 'Public' : 'Private'}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {currentBucket ? (
          <Stack spacing={1.5}>
            <AccessCard selected={currentAccess === 'public'} onClick={() => setAccess('public')}>
              <Radio checked={currentAccess === 'public'} size="small" sx={{ padding: 0, marginTop: '2px' }} />
              <Box>
                <Typography variant="subtitle2">Public</Typography>
                <Typography variant="body2" color="text.secondary">
                  Anyone with the link. Served from the cache nodes.
                </Typography>
              </Box>
            </AccessCard>
            <AccessCard selected={currentAccess === 'private'} onClick={() => setAccess('private')}>
              <Radio checked={currentAccess === 'private'} size="small" sx={{ padding: 0, marginTop: '2px' }} />
              <Box>
                <Typography variant="subtitle2">Private</Typography>
                <Typography variant="body2" color="text.secondary">
                  Only with a key you sign.
                </Typography>
              </Box>
            </AccessCard>

            <Stack direction="row" spacing={1.5} alignItems="center" marginTop="4px">
              <Box
                flex={1}
                minWidth={0}
                padding="10px 14px"
                borderRadius="8px"
                border={(theme) => `1px solid ${theme.palette.divider}`}
                sx={{ font: '13px/1.4 ui-monospace, Menlo, monospace', overflowX: 'auto', whiteSpace: 'nowrap' }}
              >
                {publicUrl}
              </Box>
              <Button variant="outlined" color="secondary" onClick={copyLink} sx={{ flexShrink: 0 }}>
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              <LoadingButton loading={isSaving} onClick={handleSave} sx={{ flexShrink: 0 }}>
                Save
              </LoadingButton>
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Select a bucket to set who can read it and get its link.
          </Typography>
        )}
      </Card>

      {/* Data served — needs the bills feed (deferred). */}
      <Card>
        <Stack direction="row" alignItems="center" justifyContent="space-between" marginBottom="16px">
          <Typography variant="subtitle1">Data served</Typography>
          <TextField select label="Period" value="1 week" size="small" sx={{ minWidth: 140 }} disabled>
            <MenuItem value="1 week">1 week</MenuItem>
          </TextField>
        </Stack>
        <Box
          padding="48px 24px"
          borderRadius="10px"
          textAlign="center"
          sx={{ border: (theme) => `1px dashed ${theme.palette.divider}` }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440, marginX: 'auto' }}>
            Data served per day, against the plan’s monthly allowance, appears here once the bills feed is wired.
          </Typography>
        </Box>
      </Card>
    </Box>
  );
};

export default observer(ContentDelivery);
