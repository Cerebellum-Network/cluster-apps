import { Docs, DocsGroup, DocsSection, FileManager } from '@developer-console/ui';
import { observer } from 'mobx-react-lite';
import { Box, styled, Typography } from '@mui/material';
import { useAccount, useFetchDirs } from '~/hooks';
import { useCallback, useEffect, useState } from 'react';
import { DagNode, DagNodeUri, Link, File as DdcFile, FileUri } from '@cere-ddc-sdk/ddc-client';
import { DDC_CLUSTER_ID } from '~/constants.ts';
import { DataStorageDocsIcon } from './icons';
import { StepByStepUploadDoc } from '~/applications/ContentStorage/docs';

const Container = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
}));

const ContentStorage = () => {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadType, setUploadType] = useState<'file' | 'folder'>('file');

  const { ddc: ddcClient, buckets } = useAccount();

  const { dirs, loading } = useFetchDirs(buckets, ddcClient);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (uploadStatus === 'success' || uploadStatus === 'error') {
      timer = setTimeout(() => {
        setUploadStatus('idle');
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [uploadStatus]);

  const onBucketCreation = useCallback(async () => {
    if (!ddcClient) return;
    await ddcClient.createBucket(DDC_CLUSTER_ID, { isPublic: true });
  }, [ddcClient]);

  const singleFileUpload = useCallback(
    async ({ acceptedFile, cnsName, bucketId }: { acceptedFile: File; bucketId: string; cnsName: string }) => {
      setUploadStatus('uploading');
      try {
        const dagNodeData = JSON.stringify({ createTime: Date.now() });
        const existingDagNode = await ddcClient!
          .read(new DagNodeUri(BigInt(bucketId), cnsName))
          .catch(() => new DagNode(dagNodeData));

        const file = new DdcFile(acceptedFile.stream() as unknown as Uint8Array, { size: acceptedFile.size });
        const uri = await ddcClient!.store(BigInt(bucketId!), file);
        const fileLink = new Link(uri.cid, acceptedFile.size, acceptedFile.name);

        const dagNode = new DagNode(dagNodeData, [
          ...existingDagNode.links.filter((link) => link.name !== acceptedFile.name),
          fileLink,
        ]);

        await ddcClient!.store(BigInt(bucketId), dagNode, { name: cnsName });
        setUploadStatus('success');
      } catch (err) {
        setUploadStatus('error');
        console.error(err);
      }
    },
    [ddcClient],
  );

  const handleUpload = useCallback(
    async ({
      acceptedFiles,
      bucketId,
      cnsName,
      isFolder,
    }: {
      acceptedFiles: File[];
      bucketId: string;
      cnsName: string;
      isFolder: boolean;
    }) => {
      setUploadType(isFolder ? 'folder' : 'file');

      if (!isFolder) {
        const acceptedFile = acceptedFiles[0];
        await singleFileUpload({ acceptedFile, bucketId, cnsName });
      }
    },
    [singleFileUpload],
  );

  const handleCloseStatus = () => {
    setUploadStatus('idle');
  };

  const handleFileDownload = async (bucketId: string, source: string, name: string) => {
    const fileUri = new FileUri(BigInt(bucketId), source, { name });
    const fileResponse = await ddcClient.read(fileUri);

    const reader = fileResponse.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get reader from response body.');
    }

    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        chunks.push(value);
      }
    }

    const length = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const arrayBuffer = new ArrayBuffer(length);
    const view = new Uint8Array(arrayBuffer);
    let position = 0;

    for (const chunk of chunks) {
      view.set(chunk, position);
      position += chunk.length;
    }

    const blob = new Blob([arrayBuffer]);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Box
        display="flex"
        flexDirection="column"
        border={(theme) => `1px solid ${theme.palette.divider}`}
        borderRadius="12px"
        marginBottom="20px"
      >
        <Box padding="34px 32px" borderBottom={(theme) => `1px solid ${theme.palette.divider}`}>
          <Typography>Content Storage</Typography>
        </Box>
        <Container padding="24px" borderRadius={(theme) => theme.spacing(0, 0, 1.5, 1.5)}>
          <FileManager
            data={dirs || []}
            isLoading={loading}
            onCreateBucket={onBucketCreation}
            onUpload={handleUpload}
            uploadType={uploadType}
            uploadStatus={uploadStatus}
            setUploadStatus={handleCloseStatus}
            onFileDownload={handleFileDownload}
          />
        </Container>
      </Box>
      <Docs
        icon={<DataStorageDocsIcon />}
        title="Get started with Decentralised cloud storage "
        description="Store your app's data securely across a decentralized network and maintain complete control over your data sovereignty"
      >
        <DocsGroup title="Upload your content using DDC SDK">
          <DocsSection title="Upload your file step-by-step guide">
            <StepByStepUploadDoc />
          </DocsSection>
          <DocsSection
            title="Quick start guide in Github"
            githubLink="https://github.com/Cerebellum-Network/cere-ddc-sdk-js/tree/main?tab=readme-ov-file#cere-ddc-sdk-for-javascripttypescript"
          />
        </DocsGroup>
      </Docs>
    </>
  );
};

export default observer(ContentStorage);
