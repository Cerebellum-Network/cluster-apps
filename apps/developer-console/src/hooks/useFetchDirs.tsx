import { useCallback, useEffect, useRef, useState } from 'react';
import Reporting from '@cluster-apps/reporting';

import { DirectoryType } from '~/applications/ContentStorage/FileManager';
import type { Bucket } from '~/stores';
import type { BucketStorage } from '~/storage/ddc/types';

interface UseFetchDirsResult {
  dirs: DirectoryType[];
  loading: boolean;
  error: string | null;
  refetchBucket: (bucketName: string) => void;
  defaultDirIndices: Record<string, number>;
  setDefaultFolderIndex: (bucketId: string, index: number) => void;
}

/** Highest `default<N>` top-level folder index among a bucket's object keys. */
const indexFromKeys = (keys: string[]): number =>
  keys.reduce((max, key) => {
    const match = key.split('/')[0]?.match(/^default(\d*)$/);
    if (!match) return max;
    return Math.max(max, match[1] ? parseInt(match[1], 10) : 0);
  }, 0);

/**
 * Lists each gateway bucket's objects (by name) through the DDC S3 gateway. Each
 * object key becomes a `DirectoryType`; the file manager's `transformData`
 * rebuilds the folder tree. A bucket with no objects still yields one empty-name
 * sentinel so it renders as a row.
 */
export const useFetchDirs = (buckets: Bucket[], storage: BucketStorage): UseFetchDirsResult => {
  const [dirs, setDirs] = useState<DirectoryType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultDirIndices, setDefaultDirIndices] = useState<Record<string, number>>({});
  const fetchedNames = useRef(new Set<string>());

  const listBucket = useCallback(
    async (bucket: Bucket): Promise<{ dirs: DirectoryType[]; index: number; ok: boolean }> => {
      const name = bucket.name;
      try {
        const objects = await storage.listObjects(name);
        const keys = objects.map((o) => o.key);
        const entries: DirectoryType[] = objects.length
          ? objects.map((o) => ({ bucketId: name, isPublic: bucket.isPublic, name: o.key, cid: o.key, size: o.size }))
          : [{ bucketId: name, isPublic: bucket.isPublic, name: '', cid: '', size: 0 }];
        return { dirs: entries, index: indexFromKeys(keys), ok: true };
      } catch (e) {
        // Surface the failure instead of caching an empty "fetched" bucket. Keep a
        // sentinel so the row still renders, and leave the bucket un-fetched so a
        // refetch retries it.
        Reporting.error(e);
        return { dirs: [{ bucketId: name, isPublic: bucket.isPublic, name: '', cid: '', size: 0 }], index: 0, ok: false };
      }
    },
    [storage],
  );

  const fetchDirs = useCallback(async () => {
    const newBuckets = buckets.filter((b) => !fetchedNames.current.has(b.name));
    if (newBuckets.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(newBuckets.map(listBucket));
      const indices: Record<string, number> = {};
      newBuckets.forEach((b, i) => {
        indices[b.name] = results[i].index;
        // Only mark a bucket "fetched" when its listing actually succeeded, so a
        // failed list is retried rather than stuck showing empty.
        if (results[i].ok) fetchedNames.current.add(b.name);
      });
      setDirs((prev) => [...prev, ...results.flatMap((r) => r.dirs)]);
      setDefaultDirIndices((prev) => ({ ...prev, ...indices }));
      if (results.some((r) => !r.ok)) setError("Couldn't list some buckets. Please retry.");
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
    async (bucketName: string) => {
      const bucket = buckets.find((b) => b.name === bucketName) ?? { name: bucketName, isPublic: false };
      const { dirs: entries, index } = await listBucket(bucket);
      fetchedNames.current.add(bucketName);
      setDirs((prev) => [...prev.filter((d) => d.bucketId !== bucketName), ...entries]);
      setDefaultDirIndices((prev) => ({ ...prev, [bucketName]: index }));
    },
    [buckets, listBucket],
  );

  const setDefaultFolderIndex = (bucketId: string, index: number) => {
    setDefaultDirIndices((prev) => ({ ...prev, [bucketId]: index }));
  };

  return { dirs, loading, error, refetchBucket, defaultDirIndices, setDefaultFolderIndex };
};
