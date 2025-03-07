import { useState, useEffect, useRef, useCallback } from 'react';
import { IndexedBucket } from '@cluster-apps/api';
import { useFetchDirs } from './useFetchDirs';
import { DirectoryType } from '~/applications/ContentStorage/FileManager';

interface CachedData {
  dirs: DirectoryType[];
  defaultDirIndices: Record<string, number>;
  timestamp: number;
}

interface UseCachedFetchDirsResult {
  dirs: DirectoryType[];
  loading: boolean;
  error: string | null;
  refetchBucket: (bucketId: bigint, isPublic?: boolean) => void;
  isCached: boolean;
  lastUpdated: number | null;
  forceRefresh: () => void;
}

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Global cache storage
const globalCache: Record<string, CachedData> = {};

export const useCachedFetchDirs = (
  buckets: IndexedBucket[], 
  ddcClient: any,
  cacheKey = 'default'
): UseCachedFetchDirsResult => {
  const {
    dirs,
    loading,
    error,
    refetchBucket: originalRefetchBucket,
    defaultDirIndices,
    setDefaultFolderIndex
  } = useFetchDirs(buckets, ddcClient);
  
  const [isCached, setIsCached] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const initialLoadComplete = useRef(false);
  const forceRefreshCounter = useRef(0);
  
  // Wrap the refetchBucket function to update the cache after refetching
  const refetchBucket = useCallback(
    async (bucketId: bigint, isPublic?: boolean) => {
      const result = await originalRefetchBucket(bucketId, isPublic);
      
      // Update the cache after refetching
      if (globalCache[cacheKey]) {
        globalCache[cacheKey].timestamp = Date.now();
        setLastUpdated(Date.now());
      }
      
      return result;
    },
    [originalRefetchBucket, cacheKey]
  );
  
  // Force refresh function
  const forceRefresh = useCallback(() => {
    // Clear the cache for this key
    delete globalCache[cacheKey];
    // Increment counter to trigger a re-fetch
    forceRefreshCounter.current += 1;
    setIsCached(false);
    initialLoadComplete.current = false;
  }, [cacheKey]);
  
  // Check if cache is valid
  const isCacheValid = useCallback((cache: CachedData): boolean => {
    const now = Date.now();
    return now - cache.timestamp < CACHE_EXPIRATION;
  }, []);
  
  // Store data in cache when it's loaded
  useEffect(() => {
    if (!loading && dirs.length > 0 && !isCached && !error) {
      // Only update cache after initial load is complete
      if (initialLoadComplete.current) {
        globalCache[cacheKey] = {
          dirs,
          defaultDirIndices,
          timestamp: Date.now()
        };
        setLastUpdated(Date.now());
        console.log(`[Cache] Updated cache for key: ${cacheKey}`);
      } else {
        initialLoadComplete.current = true;
      }
    }
  }, [loading, dirs, defaultDirIndices, isCached, error, cacheKey]);
  
  // Try to load from cache on initial render
  useEffect(() => {
    const cachedData = globalCache[cacheKey];
    
    if (cachedData && isCacheValid(cachedData) && !initialLoadComplete.current) {
      console.log(`[Cache] Using cached data for key: ${cacheKey}`);
      setIsCached(true);
      setLastUpdated(cachedData.timestamp);
      initialLoadComplete.current = true;
    }
  }, [cacheKey, forceRefreshCounter.current, isCacheValid]);
  
  // Check cache expiration periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const cachedData = globalCache[cacheKey];
      if (cachedData && !isCacheValid(cachedData)) {
        console.log(`[Cache] Cache expired for key: ${cacheKey}`);
        forceRefresh();
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [cacheKey, forceRefresh, isCacheValid]);
  
  // If we have cached data and we're loading, return the cached data
  if (isCached && loading && globalCache[cacheKey]) {
    return {
      dirs: globalCache[cacheKey].dirs,
      loading: false, // Override loading state
      error: null,
      refetchBucket,
      isCached: true,
      lastUpdated: globalCache[cacheKey].timestamp,
      forceRefresh
    };
  }
  
  // Otherwise return the current data
  return {
    dirs,
    loading,
    error,
    refetchBucket,
    isCached,
    lastUpdated,
    forceRefresh
  };
};

export default useCachedFetchDirs; 