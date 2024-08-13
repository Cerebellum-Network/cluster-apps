import { FileNode, RealData, RowData } from './types.ts';
import { DEFAULT_FOLDER_NAME, EMPTY_FILE_NAME } from '~/constants.ts';

export const calculateSize = (node: FileNode): number => {
  if (node.metadata && node.metadata.type === 'file') {
    return parseInt(node.metadata.usedStorage, 10);
  }
  if (node.children) {
    return node.children.reduce((total, child) => total + calculateSize(child), 0);
  }
  return 0;
};

export const buildTree = (files: RealData[], isPublic: boolean): FileNode => {
  const root: FileNode = { name: '', isPublic, children: [] };

  files.forEach((file) => {
    const parts = file?.name ? file.name.split('/') : [];
    let currentNode: FileNode = root;

    if (parts.length === 0) {
      currentNode.children = [];
    }

    parts.forEach((part, index) => {
      const node = { name: part, isPublic: currentNode.isPublic, children: [], fullPath: file.name };
      currentNode.children!.push(node);
      currentNode = node;

      if (index === parts.length - 1) {
        currentNode.metadata = {
          usedStorage: file.size?.toString() || '',
          cid: file?.cid || '',
          type: 'file',
          isPublic: file.isPublic,
          fullPath: file.name,
        };
        delete currentNode.children;
      }
    });
  });

  const addFolderSizes = (node: FileNode) => {
    if (node.children) {
      node.children.forEach(addFolderSizes);
      const totalSize = node.children
        .filter((s) => s.name !== `${EMPTY_FILE_NAME}`)
        .reduce((sum, child) => sum + calculateSize(child), 0);
      const child = node.children[0];
      const fullPath = child?.fullPath?.replace(`${child.name}`, '').replace('//', '/');
      node.metadata = {
        usedStorage: totalSize.toString(),
        type: 'folder',
        cid: node.metadata?.cid || '',
        isPublic: node.isPublic,
        fullPath,
      };
    }
  };

  addFolderSizes(root);
  return root;
};

export const bytesToSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const sizeInUnits = bytes / Math.pow(1024, i);
  return `${parseFloat(sizeInUnits.toFixed(2))} ${sizes[i]}`;
};

export const transformData = (data: RealData[]): RowData[] => {
  const bucketMap: { [key: string]: RealData[] } = {};

  data.forEach((file) => {
    if (!bucketMap[file.bucketId]) {
      bucketMap[file.bucketId] = [];
    }
    bucketMap[file.bucketId].push(file);
  });

  return Object.keys(bucketMap).map((bucketId) => {
    const files = bucketMap[bucketId];
    const isPublic = files.some((child) => child.isPublic);

    const rootNode = buildTree(files, isPublic);
    return {
      bucketId,
      usedStorage: bytesToSize(
        files.reduce(
          (acc, file) => acc + ((file?.name !== `${DEFAULT_FOLDER_NAME}/${EMPTY_FILE_NAME}` ? file?.size : 0) || 0),
          0,
        ),
      ),
      acl: rootNode.isPublic,
      files: rootNode,
    };
  });
};
