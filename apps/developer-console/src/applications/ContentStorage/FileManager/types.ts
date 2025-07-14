import { Link } from '@cere-ddc-sdk/ddc-client';

export type DirectoryType = Link & {
  bucketId: string;
  isPublic: boolean;
  _syncError?: boolean; // Flag to indicate bucket sync issues
  _networkError?: boolean; // Flag to indicate network issues
  _unknownError?: boolean; // Flag to indicate unknown errors
  _errorType?: 'bucket_not_found' | 'network_error' | 'unknown_error'; // Type of error
  _errorMessage?: string; // Error message for debugging
};

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
  fullPath?: string;
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
