import { Box, Typography } from '@mui/material';
import { Row } from './Row.tsx';

type RealData = {
  bucketId: string;
  size: number;
  name: string;
  cid: string;
};

type FileNode = {
  name: string;
  metadata?: {
    usedStorage: string;
    type: string;
  };
  children?: FileNode[];
};

type MockData = {
  bucketId: string;
  usedStorage: string;
  acl: string;
  files: FileNode;
};

const bytesToSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
};

const buildTree = (files: RealData[]): FileNode => {
  const root: FileNode = { name: '', children: [] };

  files.forEach((file) => {
    const parts = file.name.split('/');
    let currentNode = root;

    parts?.forEach((part, index) => {
      let node = currentNode.children?.find((child) => child.name === part);
      if (!node) {
        node = { name: part, children: [] };
        currentNode.children?.push(node);
      }
      currentNode = node;

      if (index === parts.length - 1) {
        currentNode.metadata = {
          usedStorage: bytesToSize(file.size),
          type: 'public', // Adjust according to your data
        };
        delete currentNode.children; // Remove children for file nodes
      }
    });
  });

  return root;
};

const transformData = (data: RealData[]): MockData[] => {
  const bucketMap: { [key: string]: RealData[] } = {};

  data?.forEach((file) => {
    if (!bucketMap[file.bucketId]) {
      bucketMap[file.bucketId] = [];
    }
    bucketMap[file.bucketId].push(file);
  });

  return Object.keys(bucketMap).map((bucketId) => {
    const files = bucketMap[bucketId];
    return {
      bucketId,
      usedStorage: bytesToSize(files.reduce((acc, file) => acc + file.size, 0)),
      acl: 'Public',
      files: buildTree(files),
    };
  });
};

export const FileManager = ({ data }: { data: RealData[] }) => {
  const rows = transformData(data);

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: '#f9f9f9',
        }}
      >
        <Typography variant="body1" sx={{ flex: 1 }}>
          Bucket ID
        </Typography>
        <Typography variant="body1" sx={{ flex: 1, textAlign: 'right' }}>
          Used Storage
        </Typography>
        <Typography variant="body1" sx={{ flex: 1, textAlign: 'center' }}>
          ACL
        </Typography>
        <Box sx={{ flex: 1 }}></Box> {/* Пустая колонка */}
      </Box>
      {rows.map((row) => (
        <Row key={row.bucketId} row={row} />
      ))}
    </>
  );
};
