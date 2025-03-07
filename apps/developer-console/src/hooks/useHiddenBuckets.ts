import { useState, useEffect, useCallback } from 'react';
import { useAccount } from './useAccount';

// Type for the hidden buckets
type HiddenBuckets = string[];

/**
 * Hook to manage hidden buckets in localStorage
 * This provides a UI-level feature to hide buckets
 */
export const useHiddenBuckets = () => {
  const account = useAccount();
  const [hiddenBuckets, setHiddenBuckets] = useState<HiddenBuckets>([]);
  
  // Load hidden buckets from localStorage on initial render
  useEffect(() => {
    if (!account.address) return;
    
    const storageKey = `dc:hidden-buckets:${account.address}`;
    const storedHiddenBuckets = localStorage.getItem(storageKey);
    
    if (storedHiddenBuckets) {
      try {
        setHiddenBuckets(JSON.parse(storedHiddenBuckets));
      } catch (error) {
        console.error('Failed to parse hidden buckets from localStorage:', error);
      }
    }
  }, [account.address]);
  
  // Save hidden buckets to localStorage whenever they change
  useEffect(() => {
    if (!account.address || hiddenBuckets.length === 0) return;
    
    const storageKey = `dc:hidden-buckets:${account.address}`;
    localStorage.setItem(storageKey, JSON.stringify(hiddenBuckets));
  }, [hiddenBuckets, account.address]);
  
  // Check if a bucket is hidden
  const isBucketHidden = useCallback((bucketId: string): boolean => {
    return hiddenBuckets.includes(bucketId);
  }, [hiddenBuckets]);
  
  // Hide a bucket
  const hideBucket = useCallback((bucketId: string) => {
    setHiddenBuckets(prev => {
      if (prev.includes(bucketId)) return prev;
      return [...prev, bucketId];
    });
  }, []);
  
  // Show a bucket
  const showBucket = useCallback((bucketId: string) => {
    setHiddenBuckets(prev => prev.filter(id => id !== bucketId));
  }, []);
  
  // Toggle bucket visibility
  const toggleBucketVisibility = useCallback((bucketId: string) => {
    setHiddenBuckets(prev => {
      if (prev.includes(bucketId)) {
        return prev.filter(id => id !== bucketId);
      } else {
        return [...prev, bucketId];
      }
    });
  }, []);
  
  return {
    hiddenBuckets,
    isBucketHidden,
    hideBucket,
    showBucket,
    toggleBucketVisibility
  };
}; 