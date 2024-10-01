import { useState, useCallback, useRef, useEffect } from 'react';
import { DagNodeUri, Link } from '@cere-ddc-sdk/ddc-client';
import { IndexedBucket } from '@cluster-apps/api';
import { reportError } from '@cluster-apps/reporting';

import { DirectoryType } from '~/applications/ContentStorage/FileManager';

interface UseFetchDirsResult {
  dirs: DirectoryType[];
  loading: boolean;
  error: string | null;
  refetchBucket: (bucketId: bigint) => void;
  defaultDirIndices: Record<string, number>;
  setDefaultFolderIndex: (bucketId: string, index: number) => void;
}

export const useFetchDirs = (buckets: IndexedBucket[], ddcClient: any): UseFetchDirsResult => {
  const [dirs, setDirs] = useState<DirectoryType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultDirIndices, setDefaultDirIndices] = useState<Record<string, number>>({});

  const fetched = useRef(false);

  const fetchDirs = useCallback(async () => {
    if (!ddcClient || fetched.current) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newDirs: DirectoryType[] = [];
      const indices: Record<string, number> = {};
      for (const bucket of buckets) {
        const dagUri = new DagNodeUri(BigInt(bucket.id), 'fs');
        try {
          const dir = await ddcClient.read(dagUri, {
            cacheControl: 'no-cache',
          });
          if (dir) {
            const links: Link[] = dir.links;
            for (const link of links) {
              newDirs.push({ bucketId: bucket.id.toString(), isPublic: bucket.isPublic, ...link });
              const match = link.name.match(/^default(\d*)/);
              if (match) {
                const index = match[1] ? parseInt(match[1], 10) : 0;
                indices[bucket.id.toString()] = Math.max(indices[bucket.id.toString()] || 0, index);
              }
            }
          }
        } catch (dirError) {
          reportError(dirError);
          newDirs.push({ bucketId: bucket.id.toString(), isPublic: bucket.isPublic, ...({} as Link) });
          console.error(`Error reading directory for bucket ${bucket.id}:`, dirError);
        }
      }
      setDirs((prevState) => [...prevState, ...newDirs]);
      setDefaultDirIndices(indices);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      fetched.current = true;
    }
  }, [buckets, ddcClient]);

  useEffect(() => {
    fetchDirs();
  }, [fetchDirs]);

  const refetchBucket = useCallback(
    async (bucketId: bigint, isPublic: boolean) => {
      if (!ddcClient) {
        return;
      }

      try {
        const dagUri = new DagNodeUri(bucketId, 'fs');
        const newDirs: DirectoryType[] = [];
        const indices: Record<string, number> = {};
        try {
          const dir = await ddcClient.read(dagUri, {
            cacheControl: 'no-cache',
          });
          if (dir) {
            const links: Link[] = dir.links;
            for (const link of links) {
              newDirs.push({ bucketId: bucketId.toString(), isPublic, ...link });

              const match = link.name.match(/^default(\d*)/);
              if (match) {
                const index = match[1] ? parseInt(match[1], 10) : 0;
                indices[bucketId.toString()] = Math.max(indices[bucketId.toString()] || 0, index);
              }
            }
          }
        } catch (dirError) {
          console.error(`Error reading directory for bucket ${bucketId}:`, dirError);
          newDirs.push({ bucketId: bucketId.toString(), isPublic, ...({} as Link) });
        }

        setDirs((prevDirs) => [...prevDirs.filter((dir) => dir.bucketId !== bucketId.toString()), ...newDirs]);
        setDefaultDirIndices((prevIndices) => ({ ...prevIndices, ...indices }));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [ddcClient],
  );

  const setDefaultFolderIndex = (bucketId: string, index: number) => {
    setDefaultDirIndices((prevIndices) => ({ ...prevIndices, [bucketId]: index }));
  };

  return { dirs, loading, error, refetchBucket, defaultDirIndices, setDefaultFolderIndex };
};
