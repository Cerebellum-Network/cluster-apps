import { FileManager, useMessages } from '@developer-console/ui';
import { observer } from 'mobx-react-lite';
import { Box, styled, Typography } from '@mui/material';
import { useAccount } from '~/hooks';
import { useCallback, useEffect, useState } from 'react';
import { DagNodeUri, Link } from '@cere-ddc-sdk/ddc-client';

const Container = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
}));

const ContentStorage = () => {
  const [dirs, setDirs] = useState<(Link & { bucketId: string; isPublic: boolean })[]>([]);
  const { showMessage } = useMessages();

  const { ddc: ddcClient, buckets } = useAccount();

  useEffect(() => {
    const fetchDirs = async () => {
      if (!ddcClient) {
        return;
      }
      try {
        const dirPromises = buckets.map(async (bucket) => {
          const dagUri = new DagNodeUri(bucket.id, 'fs');
          const dir = await ddcClient.read(dagUri);
          if (dir) {
            return dir.links.map((link) => ({
              bucketId: bucket.id,
              isPublic: bucket.isPublic,
              ...link,
            }));
          }
          return [];
        });

        const results = await Promise.all(dirPromises);
        const newDirs = results.flat();

        setDirs((prevState) => {
          const uniqueDirs = newDirs.filter(
            (newDir) =>
              !prevState.some((prevDir) => prevDir.bucketId === newDir.bucketId && prevDir.name === newDir.name),
          );
          return [...prevState, ...uniqueDirs];
        });
      } catch (e) {
        showMessage({
          appearance: 'error',
          placement: {
            vertical: 'top',
            horizontal: 'right',
          },
          message: e.message,
        });
      }
    };

    fetchDirs();
  }, [buckets, ddcClient, showMessage]);

  const onBucketCreation = useCallback(async () => {}, []);

  return (
    <Box
      display="flex"
      flexDirection="column"
      border={(theme) => `1px solid ${theme.palette.divider}`}
      borderRadius="12px"
    >
      <Box padding="34px 32px" borderBottom={(theme) => `1px solid ${theme.palette.divider}`}>
        <Typography>Content Storage</Typography>
      </Box>
      <Container padding="24px" borderRadius={(theme) => theme.spacing(0, 0, 1.5, 1.5)}>
        <FileManager data={dirs || []} onCreateBucket={onBucketCreation} />
      </Container>
    </Box>
  );
};

export default observer(ContentStorage);
