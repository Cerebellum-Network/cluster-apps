import { AnalyticsId } from '@developer-console/analytics';
import { reportError } from '@developer-console/reporting';
import { Docs, DocsGroup, DocsSection, GithubLogoIcon, Box, Button, styled, Typography } from '@developer-console/ui';
import { observer } from 'mobx-react-lite';
import { useAccount, useFetchDirs } from '~/hooks';
import { useCallback, useEffect, useState } from 'react';
import { DagNode, DagNodeUri, Link, File as DdcFile, FileUri, Tag } from '@cere-ddc-sdk/ddc-client';
import { DataStorageDocsIcon } from './icons';
import { GITHUB_GUIDE_LINK, StepByStepUploadDoc } from '~/applications/ContentStorage/docs';
import { FileManager } from './FileManager/FileManager';
import { Bucket } from '~/stores';

const Container = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
}));

const ContentStorage = () => {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<'file' | 'folder'>('file');
  const [isBucketCreating, setIsBucketCreating] = useState(false);
  const [firstBucketLocked, setFirstBucketLocked] = useState(true);

  const account = useAccount();

  const ddcClient = account.ddc;

  const [buckets, setBuckets] = useState<Bucket[]>(account.buckets || []);

  const { dirs, loading, refetchBucket } = useFetchDirs(buckets, ddcClient);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (uploadStatus === 'success' || uploadStatus === 'error') {
      timer = setTimeout(() => {
        setUploadStatus('idle');
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [uploadStatus]);

  useEffect(() => {
    const firstBucketLocked = localStorage.getItem('firstBucketLocked');
    if (firstBucketLocked === 'false') {
      setFirstBucketLocked(false);
    }
  }, []);

  const onBucketCreation = useCallback(async () => {
    if (!ddcClient) return;
    setIsBucketCreating(true);
    const createdBucketId = await account.createBucket({ isPublic: true });
    const bucketInfo = await ddcClient.getBucket(createdBucketId);
    if (bucketInfo) {
      setBuckets((prevState) => {
        return [
          ...prevState,
          { id: bucketInfo.bucketId, isPublic: bucketInfo.isPublic, isRemoved: bucketInfo.isRemoved, stats: undefined },
        ];
      });
      await refetchBucket(createdBucketId);
      setSelectedBucket(createdBucketId.toString());
    }
    setIsBucketCreating(false);
  }, [account, ddcClient, refetchBucket]);

  const singleFileUpload = useCallback(
    async ({
      acceptedFile,
      cnsName,
      bucketId,
      isFolder,
      filePath,
    }: {
      acceptedFile: File;
      bucketId: string;
      cnsName: string;
      isFolder: boolean;
      filePath?: string;
    }) => {
      const dagNodeData = JSON.stringify({ createTime: Date.now() });
      const existingDagNode = await ddcClient!
        .read(new DagNodeUri(BigInt(bucketId), cnsName), {
          cacheControl: 'no-cache',
        })
        .catch(() => new DagNode(dagNodeData));

      const file = new DdcFile(acceptedFile.stream() as unknown as Uint8Array, { size: acceptedFile.size });
      const uri = await ddcClient!.store(BigInt(bucketId!), file);
      const fileLink = new Link(
        uri.cid,
        acceptedFile.size,
        isFolder
          ? `${filePath || ''}${acceptedFile.webkitRelativePath !== '' ? acceptedFile.webkitRelativePath : acceptedFile.name}`
          : `${filePath ? filePath : ''}${acceptedFile.name}`,
      );

      const dagNode = new DagNode(dagNodeData, [
        ...existingDagNode.links.filter((link) => link.name !== acceptedFile.name),
        fileLink,
      ]);

      await ddcClient!.store(BigInt(bucketId), dagNode, { name: cnsName });
      return {
        cid: uri.cid,
        path: `${filePath || ''}${acceptedFile.webkitRelativePath || acceptedFile.name}`,
        contentType: acceptedFile.type,
        size: acceptedFile.size,
      };
    },
    [ddcClient],
  );

  const handleUpload = useCallback(
    async ({
      acceptedFiles,
      bucketId,
      cnsName,
      isFolder,
      filePath,
    }: {
      acceptedFiles: File[];
      bucketId: string;
      cnsName: string;
      isFolder: boolean;
      filePath?: string;
    }) => {
      setUploadType(isFolder ? 'folder' : 'file');

      if (!isFolder) {
        setUploadStatus('uploading');
        try {
          const acceptedFile = acceptedFiles[0];
          await singleFileUpload({ acceptedFile, bucketId, cnsName, filePath, isFolder: false });
          await new Promise((resolve) => setTimeout(resolve, 5000));
          await refetchBucket(BigInt(bucketId));
          setUploadStatus('success');

          return;
        } catch (err) {
          reportError(err);
          setUploadStatus('error');
          console.error(err);
          return null;
        }
      }
      try {
        setUploadStatus('uploading');
        const uploadedFiles = await Promise.all(
          acceptedFiles.map(
            async (acceptedFile) =>
              await singleFileUpload({ acceptedFile, cnsName, bucketId, filePath, isFolder: true }),
          ),
        );

        const validUploadedFiles = uploadedFiles.filter(
          (file): file is { path: string; cid: string; size: number; contentType: string } =>
            file !== null && file !== undefined,
        );

        const dagNodeData = JSON.stringify({ createTime: Date.now() });
        const existingDagNode = await ddcClient!
          .read(new DagNodeUri(BigInt(bucketId), cnsName), {
            cacheControl: 'no-cache',
          })
          .catch(() => new DagNode(dagNodeData));

        const appDagNode = new DagNode(
          JSON.stringify({ createTime: Date.now() }),
          [...existingDagNode.links, ...validUploadedFiles.map(({ path, cid, size }) => new Link(cid, size, path))],
          validUploadedFiles.map(({ contentType }) => new Tag('content-type', contentType)),
        );

        const appDagNodeUri = await ddcClient.store(BigInt(bucketId), appDagNode, cnsName ? { name: cnsName } : {});

        await new Promise((resolve) => setTimeout(resolve, 5000));

        await refetchBucket(BigInt(bucketId));

        setUploadStatus('success');

        return appDagNodeUri.cid;
      } catch (e) {
        setUploadStatus('error');
        console.error(e);
        return null;
      }
    },
    [ddcClient, refetchBucket, singleFileUpload],
  );

  const handleCloseStatus = () => {
    setUploadStatus('idle');
  };

  const handleFileDownload = async (bucketId: string, source: string, name: string) => {
    const fileUri = new FileUri(BigInt(bucketId), source, { name });
    const fileResponse = await ddcClient.read(fileUri, {
      cacheControl: 'no-cache',
    });

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

  const handleFirstBucketUnlock = useCallback(async () => {
    setIsBucketCreating(true);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    setIsBucketCreating(false);
    setFirstBucketLocked(false);
    localStorage.setItem('firstBucketLocked', 'false');
  }, []);

  const handleRowClick = useCallback(
    (bucketId: string) => {
      if (!(firstBucketLocked && buckets.length > 0)) {
        setSelectedBucket((prev) => (prev === bucketId ? null : bucketId));
      }
    },
    [buckets.length, firstBucketLocked],
  );

  console.log('CURRET_ROW', selectedBucket);
  console.log('BUCKETS', buckets);

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
            userHasBuckets={buckets.length > 0 || false}
            isLoading={loading}
            onCreateBucket={onBucketCreation}
            onUpload={handleUpload}
            uploadType={uploadType}
            uploadStatus={uploadStatus}
            setUploadStatus={handleCloseStatus}
            onFileDownload={handleFileDownload}
            isBucketCreating={isBucketCreating}
            firstBucketLocked={firstBucketLocked}
            onUnlockFirstBucket={handleFirstBucketUnlock}
            onRowClick={handleRowClick}
            selectedBucket={selectedBucket}
          />
        </Container>
      </Box>
      <Docs
        icon={<DataStorageDocsIcon />}
        title="Get started with Decentralised cloud storage "
        description="Store your app's data securely across a decentralized network and maintain complete control over your data sovereignty"
      >
        <DocsGroup title="Upload your content using DDC SDK">
          <DocsSection analyticId={AnalyticsId.starterGuideStorage} title="Upload your file step-by-step guide">
            <StepByStepUploadDoc />
          </DocsSection>
          <DocsSection
            title="Quick start guide in Github"
            rightSection={
              <Button
                className={AnalyticsId.repoCereDdcSdkJsBtn}
                href={GITHUB_GUIDE_LINK}
                startIcon={<GithubLogoIcon />}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Github
              </Button>
            }
          />
        </DocsGroup>
      </Docs>
    </>
  );
};

export default observer(ContentStorage);
