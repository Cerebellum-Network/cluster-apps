import { Box, Button, Typography } from '@mui/material';
import { Row } from './Row.tsx';

import { AddCircleOutlinedIcon } from '@developer-console/ui';

type RealData = {
  bucketId: string;
  size: number;
  name: string;
  cid: string;
  isPublic: boolean;
};

type FileNode = {
  name: string;
  isPublic: boolean;
  metadata?: {
    usedStorage: string;
    type: string;
    cid: string;
    isPublic: boolean;
  };
  children?: FileNode[];
};

type MockData = {
  bucketId: string;
  usedStorage: string;
  acl: boolean;
  files: FileNode;
};

const bytesToSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
};

const calculateSize = (node: FileNode): number => {
  if (node.metadata && node.metadata.type !== 'folder') {
    return parseFloat(node.metadata.usedStorage);
  }
  if (node.children) {
    return node.children.reduce((total, child) => total + calculateSize(child), 0);
  }
  return 0;
};

const buildTree = (files: RealData[]): FileNode => {
  const root: FileNode = { name: '', isPublic: true, children: [] };

  files.forEach((file) => {
    const parts = file.name.split('/');
    let currentNode = root;

    parts.forEach((part, index) => {
      let node = currentNode.children?.find((child) => child.name === part);
      if (!node) {
        node = { name: part, children: [], isPublic: currentNode.isPublic };
        currentNode.children?.push(node);
      }
      currentNode = node;

      if (index === parts.length - 1) {
        currentNode.metadata = {
          usedStorage: file.size.toString(),
          cid: file.cid,
          type: 'file',
          isPublic: file.isPublic,
        };
        delete currentNode.children;
      }
    });
  });

  const addFolderSizes = (node: FileNode) => {
    if (node.children) {
      node.children.forEach(addFolderSizes);
      const totalSize = node.children.reduce((sum, child) => sum + calculateSize(child), 0);
      node.metadata = {
        usedStorage: totalSize.toString(),
        type: 'folder',
        cid: node.metadata?.cid || '',
        isPublic: node.metadata?.isPublic || true,
      };
    }
  };

  addFolderSizes(root);
  return root;
};

const transformData = (data: RealData[]): MockData[] => {
  const bucketMap: { [key: string]: RealData[] } = {};

  data.forEach((file) => {
    if (!bucketMap[file.bucketId]) {
      bucketMap[file.bucketId] = [];
    }
    bucketMap[file.bucketId].push(file);
  });

  return Object.keys(bucketMap).map((bucketId) => {
    const files = bucketMap[bucketId];
    const rootNode = buildTree(files);
    return {
      bucketId,
      usedStorage: bytesToSize(files.reduce((acc, file) => acc + file.size, 0)),
      acl: rootNode.isPublic,
      files: rootNode,
    };
  });
};
export const FileManager = ({ data, onCreateBucket }: { data: RealData[]; onCreateBucket: () => void }) => {
  const rows = transformData(data);

  return (
    <>
      <Box display="flex" alignItems="center" padding={(theme) => theme.spacing(1, 1.5)}>
        <Typography variant="body1" flex={1}>
          Bucket ID
        </Typography>
        <Typography variant="body1" flex={1} textAlign="right">
          Used Storage
        </Typography>
        <Typography variant="body1" flex={1} textAlign="center">
          ACL
        </Typography>
        <Box flex={1}></Box>
      </Box>
      {rows.length > 0 ? (
        rows.map((row) => <Row key={row.bucketId} row={row} />)
      ) : (
        <Button onClick={onCreateBucket}>
          <AddCircleOutlinedIcon />
          Create New Bucket
        </Button>
      )}
    </>
  );
};
