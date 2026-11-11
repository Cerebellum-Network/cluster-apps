import { useState, useCallback, useRef, useEffect } from 'react';
import Reporting from '@cluster-apps/reporting';

import { DirectoryType } from '~/applications/ContentStorage/FileManager';
import type { Bucket } from '~/stores';
import type { BucketStorage } from '~/storage/ddc/types';

interface UseFetchDirsResult {
  dirs: DirectoryType[];
  loading: boolean;
  error: string | null;
  refetchBucket: (bucketId: bigint, isPublic?: boolean) => void;
  defaultDirIndices: Record<string, number>;
  setDefaultFolderIndex: (bucketId: string, index: number) => void;
}

/** Highest `default<N>` top-level folder index seen among a bucket's object keys. */
const indexFromKeys = (keys: string[]): number =>
  keys.reduce((max, key) => {
    const match = key.split('/')[0]?.match(/^default(\d*)$/);
    if (!match) return max;
    return Math.max(max, match[1] ? parseInt(match[1], 10) : 0);
  }, 0);

/**
 * Lists each bucket's objects through the DDC S3 gateway (replacing the old
 * `fs` DAG-node read). Each object key becomes one `DirectoryType`; the
 * file-manager's `transformData` rebuilds the folder tree from the key paths.
 */
export const useFetchDirs = (buckets: Bucket[], storage: BucketStorage): UseFetchDirsResult => {
  const [dirs, setDirs] = useState<DirectoryType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultDirIndices, setDefaultDirIndices] = useState<Record<string, number>>({});

  const fetchedBucketIds = useRef(new Set<string>());

  const listBucket = useCallback(
    async (bucket: Bucket): Promise<{ dirs: DirectoryType[]; index: number }> => {
      const bucketId = bucket.id.toString();
      try {
        const keys = (await storage.listObjects(bucketId)).filter(Boolean);
        return {
          dirs: keys.map<DirectoryType>((key) => ({
            bucketId,
            isPublic: bucket.isPublic,
            name: key,
            cid: key,
            size: 0,
          })),
          index: indexFromKeys(keys),
        };
      } catch (e) {
        // An empty / not-yet-authorized bucket lists nothing; keep the row.
        Reporting.error(e);
        return { dirs: [], index: 0 };
      }
    },
    [storage],
  );

  const fetchDirs = useCallback(async () => {
    const newBuckets = buckets.filter((b) => !fetchedBucketIds.current.has(b.id.toString()));
    if (newBuckets.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(newBuckets.map(listBucket));
      const newDirs = results.flatMap((r) => r.dirs);
      const indices: Record<string, number> = {};
      newBuckets.forEach((b, i) => {
        indices[b.id.toString()] = results[i].index;
        fetchedBucketIds.current.add(b.id.toString());
      });
      setDirs((prev) => [...prev, ...newDirs]);
      setDefaultDirIndices((prev) => ({ ...prev, ...indices }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [buckets, listBucket]);

  useEffect(() => {
    void fetchDirs();
  }, [fetchDirs]);

  const refetchBucket = useCallback(
    async (bucketId: bigint, isPublic: boolean = false) => {
      const id = bucketId.toString();
      try {
        const { dirs: newDirs, index } = await listBucket({ id: bucketId, isPublic, isRemoved: false });
        fetchedBucketIds.current.add(id);
        setDirs((prev) => [...prev.filter((d) => d.bucketId !== id), ...newDirs]);
        setDefaultDirIndices((prev) => ({ ...prev, [id]: index }));
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [listBucket],
  );

  const setDefaultFolderIndex = (bucketId: string, index: number) => {
    setDefaultDirIndices((prevIndices) => ({ ...prevIndices, [bucketId]: index }));
  };

  return { dirs, loading, error, refetchBucket, defaultDirIndices, setDefaultFolderIndex };
};
