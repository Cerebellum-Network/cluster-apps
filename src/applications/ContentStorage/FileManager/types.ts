import { Link } from '@cere-ddc-sdk/ddc-client';

export type DirectoryType = Link & { bucketId: string; isPublic: boolean };

export type RealData = {
  bucketId: string;
  size?: number;
  name?: string;
  cid?: string;
  isPublic: boolean;
};

export type FileNode = {
  name: string;
  isPublic: boolean;
  metadata?: {
    usedStorage: string;
    type: string;
    cid: string;
    isPublic: boolean;
    fullPath?: string;
  };
  children?: FileNode[];
};

export type RowData = {
  bucketId: string;
  usedStorage: string;
  acl: boolean;
  files: FileNode;
};
