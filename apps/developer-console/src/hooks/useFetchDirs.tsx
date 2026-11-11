import { useEffect, useState } from 'react';

import { DirectoryType } from '~/applications/ContentStorage/FileManager';
import type { Bucket } from '~/stores';

interface UseFetchDirsResult {
  dirs: DirectoryType[];
  loading: boolean;
  error: string | null;
  refetchBucket: (bucketId: bigint, isPublic?: boolean) => void;
  defaultDirIndices: Record<string, number>;
  setDefaultFolderIndex: (bucketId: string, index: number) => void;
}

/**
 * Phase 0 is a read-only revival: the console lists the account's buckets (from
 * the blockchain index) but does not list their objects. Object listing/upload
 * go through the DDC S3 gateway, which only serves buckets created through it --
 * that write path is deferred to the gateway-integration phase. So here we emit
 * one placeholder entry per bucket, which the file manager renders as a bucket
 * row with an (empty) contents tree.
 */
export const useFetchDirs = (buckets: Bucket[]): UseFetchDirsResult => {
  const [dirs, setDirs] = useState<DirectoryType[]>([]);
  const [defaultDirIndices, setDefaultDirIndices] = useState<Record<string, number>>({});

  useEffect(() => {
    setDirs(
      buckets.map((bucket) => ({
        bucketId: bucket.id.toString(),
        isPublic: bucket.isPublic,
        name: '',
        cid: '',
        size: 0,
      })),
    );
  }, [buckets]);

  // No-ops in the read-only phase (kept so the file-manager contract is stable).
  const refetchBucket = () => {};
  const setDefaultFolderIndex = (bucketId: string, index: number) => {
    setDefaultDirIndices((prev) => ({ ...prev, [bucketId]: index }));
  };

  return { dirs, loading: false, error: null, refetchBucket, defaultDirIndices, setDefaultFolderIndex };
};
