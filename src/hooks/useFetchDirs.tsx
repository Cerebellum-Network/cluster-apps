import { useState, useCallback, useRef, useEffect } from 'react';
import { DagNodeUri, Link } from '@cere-ddc-sdk/ddc-client';
import { IndexedBucket } from '@developer-console/api';
import { DirectoryType } from '@developer-console/ui';

interface UseFetchDirsResult {
  dirs: DirectoryType[];
  loading: boolean;
  error: string | null;
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
          // console.error(`Error reading directory for bucket ${bucket.id}:`, dirError);
        }
      }
      setDirs((prevState) => {
        const uniqueDirs = newDirs.filter(
          (newDir) =>
            !prevState.some((prevDir) => prevDir.bucketId === newDir.bucketId && prevDir.name === newDir.name),
        );
        return [...prevState, ...uniqueDirs];
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

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mock = [
    {
      bucketId: '200883',
      isPublic: false,
      cid: 'baebb4igympzgyi6uwiqff6dgfaeykgeg6c6uyhlkuxbtows65k5sj7pwqu',
      name: 'assets/bg.jpg',
      size: 50098,
    },
    {
      bucketId: '200883',
      isPublic: false,
      cid: 'baebb4icrjg62o4tku6k2mjtm47tsn5iqjalr7eddtp36cseylrcbvmzc7e',
      name: 'assets/styles.css',
      size: 173,
    },
    {
      bucketId: '200883',
      isPublic: false,
      cid: 'baebb4iar25fccjc42jo6pfdus6whik3h3lusglaktvksnms54plwhppb5q',
      name: 'index.html',
      size: 198,
    },
    {
      bucketId: '200893',
      isPublic: true,
      cid: 'baebb4igympzgyi6uwiqff6dgfaeykgeg6c6uyhlkuxbtows65k5sj7pwqu',
      name: 'assets/bg.jpg',
      size: 50098,
    },
    {
      bucketId: '200893',
      isPublic: true,
      cid: 'baebb4icrjg62o4tku6k2mjtm47tsn5iqjalr7eddtp36cseylrcbvmzc7e',
      name: 'assets/styles.css',
      size: 173,
    },
    {
      bucketId: '200893',
      isPublic: true,
      cid: 'baebb4iar25fccjc42jo6pfdus6whik3h3lusglaktvksnms54plwhppb5q',
      name: 'index.html',
      size: 198,
    },
  ];

  return { dirs, loading, error };
};
