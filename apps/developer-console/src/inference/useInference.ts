// Inference data hooks. The Models catalogue is public (gateway + CDN GETs), so
// no wallet/account is needed here — unlike the API-key panel (later slice). The
// list comes from the gateway, then each model is enriched with its CDN manifest
// (price, context window, hosting) in parallel; a missing manifest degrades to a
// card without that enrichment.
import { useCallback, useEffect, useState } from 'react';

import { useAccount } from '~/hooks';
import { listOwnerBuckets, type OwnerBucket } from '~/storage/ddc/ownerBuckets';
import { ensureBillingBucket } from './billingBucket';
import { listModels, getModelManifest } from './gateway';
import { latestPerModel, toModelCard, type ModelCard } from './model';

export interface ModelsState {
  cards: ModelCard[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useModels(): ModelsState {
  const [cards, setCards] = useState<ModelCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listModels()
      .then(async (models) => {
        const built = await Promise.all(
          latestPerModel(models).map(async (m) => toModelCard(m, await getModelManifest(m.bucket, m.name, m.version))),
        );
        if (!cancelled) setCards(built);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load models.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { cards, loading, error, reload };
}

export interface OwnerBucketsState {
  buckets: OwnerBucket[];
  loading: boolean;
  error: string | null;
}

export interface OwnerBuckets extends OwnerBucketsState {
  /** The id a new key bills to: the first bucket, or one created now (see billingBucket.ts). */
  ensureBucket: () => Promise<string>;
}

/**
 * The connected wallet's on-chain buckets (numeric ids), from the blockchain
 * index — the id an Inference API key bills to. Removed buckets are dropped. The
 * key must be scoped to a bucket the wallet owns, so this is the source for the
 * key panel's bucket picker.
 */
export function useOwnerBuckets(): OwnerBuckets {
  const account = useAccount();
  const pubkey = account.account ?? null;
  // Tagged with the account they were read for: after a wallet switch the old
  // account's buckets are gone in the same render, so nothing (a usage token
  // mint, a new key) ever pairs the new owner with the old owner's bucket.
  const [state, setState] = useState<{ for: string | null } & OwnerBucketsState>({ for: null, buckets: [], loading: false, error: null });

  useEffect(() => {
    if (!pubkey) {
      setState({ for: null, buckets: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ for: pubkey, buckets: [], loading: true, error: null });
    listOwnerBuckets(pubkey)
      .then((list) => {
        if (!cancelled) setState({ for: pubkey, buckets: list.filter((b) => !b.isRemoved), loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ for: pubkey, buckets: [], loading: false, error: e instanceof Error ? e.message : 'Could not read your buckets.' });
      });
    return () => {
      cancelled = true;
    };
  }, [pubkey]);

  const current = state.for === pubkey ? state : { buckets: [], loading: !!pubkey, error: null };
  const ensureBucket = useCallback(async () => {
    if (!pubkey) throw new Error('Sign in first.');
    const id = await ensureBillingBucket({ current: current.buckets, create: () => account.createBucket(), list: () => listOwnerBuckets(pubkey) });
    if (current.buckets.length === 0) {
      // Show the new bucket from now on (the pages read buckets[0]).
      const list = await listOwnerBuckets(pubkey).catch(() => null);
      if (list) setState({ for: pubkey, buckets: list.filter((b) => !b.isRemoved), loading: false, error: null });
    }
    return id;
  }, [account, pubkey, current.buckets]);

  return { buckets: current.buckets, loading: current.loading, error: current.error, ensureBucket };
}
