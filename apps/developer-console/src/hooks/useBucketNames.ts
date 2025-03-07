import { useState, useEffect, useCallback } from 'react';
import { useAccount } from './useAccount';

// Type for the bucket names mapping
type BucketNames = Record<string, string>;

/**
 * Hook to manage bucket names in localStorage
 * This provides a UI-level naming feature for buckets
 */
export const useBucketNames = () => {
  const account = useAccount();
  const [bucketNames, setBucketNames] = useState<BucketNames>({});
  
  // Load bucket names from localStorage on initial render
  useEffect(() => {
    if (!account.address) return;
    
    const storageKey = `dc:bucket-names:${account.address}`;
    const storedNames = localStorage.getItem(storageKey);
    
    if (storedNames) {
      try {
        setBucketNames(JSON.parse(storedNames));
      } catch (error) {
        console.error('Failed to parse bucket names from localStorage:', error);
      }
    }
  }, [account.address]);
  
  // Save bucket names to localStorage whenever they change
  useEffect(() => {
    if (!account.address || Object.keys(bucketNames).length === 0) return;
    
    const storageKey = `dc:bucket-names:${account.address}`;
    localStorage.setItem(storageKey, JSON.stringify(bucketNames));
  }, [bucketNames, account.address]);
  
  // Get a bucket name by ID
  const getBucketName = useCallback((bucketId: string): string => {
    return bucketNames[bucketId] || `Bucket ${bucketId}`;
  }, [bucketNames]);
  
  // Set a bucket name
  const setBucketName = useCallback((bucketId: string, name: string) => {
    setBucketNames(prev => ({
      ...prev,
      [bucketId]: name
    }));
  }, []);
  
  return {
    bucketNames,
    getBucketName,
    setBucketName
  };
}; 