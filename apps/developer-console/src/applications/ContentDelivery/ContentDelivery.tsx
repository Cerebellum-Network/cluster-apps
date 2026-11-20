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
import { PageHeader, Section, ComingSoon } from '~/components';

/**
 * Content Delivery (mockup): per-bucket read access (public / private), the
 * public link, and a "Data served" chart. Access + link are wired to the tracked
 * buckets; the served-per-day chart needs the bills feed (deferred), so it shows
 * an empty state for now.
 */
type Access = 'public' | 'private';

const AccessCard = styled(Box, { shouldForwardProp: (p) => p !== 'selected' })<{ selected: boolean }>(
  ({ theme, selected }) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    borderRadius: 8,
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
    <Stack spacing="20px">
      <PageHeader title="Delivery" />

      {/* Access */}
      <Section
        title={currentBucket ? `Who can read bucket ${currentBucket.name}` : 'Pick a bucket to manage delivery'}
        actions={
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
        }
      >

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
              {/* Save is the primary action, so it's the one filled button (#192 review). */}
              <LoadingButton variant="contained" loading={isSaving} onClick={handleSave} sx={{ flexShrink: 0 }}>
                Save
              </LoadingButton>
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Select a bucket to set who can read it and get its link.
          </Typography>
        )}
      </Section>

      {/* Data served — needs the bills feed, so the section holds its place with a
          Coming soon badge rather than a developer note. */}
      <Section title="Data served" actions={<ComingSoon />}>
        <Typography variant="body2" sx={{ color: '#5E5C6B' }}>
          Data served per day, against your plan’s monthly allowance, will show here once your plan is active.
        </Typography>
      </Section>
    </Stack>
  );
};

export default observer(ContentDelivery);
