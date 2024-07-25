import { useState, useCallback, useRef, useEffect } from 'react';
import { DagNodeUri, Link } from '@cere-ddc-sdk/ddc-client';
import { IndexedBucket } from '@developer-console/api';
import { reportError } from '@developer-console/reporting';

import { DirectoryType } from '~/applications/ContentStorage/FileManager';

interface UseFetchDirsResult {
  dirs: DirectoryType[];
  loading: boolean;
  error: string | null;
  refetchBucket: (bucketId: bigint) => void;
}

export const useFetchDirs = (buckets: IndexedBucket[], ddcClient: any): UseFetchDirsResult => {
  const [dirs, setDirs] = useState<DirectoryType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetched = useRef(false);

  const fetchDirs = useCallback(async () => {
    if (!ddcClient || fetched.current) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newDirs: DirectoryType[] = [];
      for (const bucket of buckets) {
        const dagUri = new DagNodeUri(BigInt(bucket.id), 'fs');
        try {
          const dir = await ddcClient.read(dagUri);
          if (dir) {
            const links: Link[] = dir.links;
            for (const link of links) {
              newDirs.push({ bucketId: bucket.id.toString(), isPublic: bucket.isPublic, ...link });
            }
          }
        } catch (dirError) {
          reportError(dirError);
          newDirs.push({ bucketId: bucket.id.toString(), isPublic: bucket.isPublic, ...({} as Link) });
          console.error(`Error reading directory for bucket ${bucket.id}:`, dirError);
        }
      }
      setDirs((prevState) => {
        return [...prevState, ...newDirs];
      });
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
    async (bucketId: bigint) => {
      if (!ddcClient) {
        return;
      }

      try {
        const dagUri = new DagNodeUri(bucketId, 'fs');
        const newDirs: DirectoryType[] = [];
        try {
          const dir = await ddcClient.read(dagUri);
          if (dir) {
            const links: Link[] = dir.links;
            for (const link of links) {
              newDirs.push({ bucketId: bucketId.toString(), isPublic: true, ...link });
            }
          }
        } catch (dirError) {
          console.error(`Error reading directory for bucket ${bucketId}:`, dirError);
          newDirs.push({ bucketId: bucketId.toString(), isPublic: true, ...({} as Link) });
        }

        setDirs((prevDirs) => {
          return [...prevDirs.filter((dir) => dir.bucketId !== bucketId.toString()), ...newDirs];
        });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [ddcClient],
  );

  return { dirs, loading, error, refetchBucket };
};
