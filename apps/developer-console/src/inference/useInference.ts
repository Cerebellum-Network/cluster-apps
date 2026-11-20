// Inference data hooks. The Models catalogue is public (gateway + CDN GETs), so
// no wallet/account is needed here — unlike the API-key panel (later slice). The
// list comes from the gateway, then each model is enriched with its CDN manifest
// (price, context window, hosting) in parallel; a missing manifest degrades to a
// card without that enrichment.
import { useCallback, useEffect, useState } from 'react';

import { useAccount } from '~/hooks';
import { listOwnerBuckets, type OwnerBucket } from '~/storage/ddc/ownerBuckets';
import { listModels, getModelManifest } from './gateway';
import { toModelCard, type ModelCard } from './model';

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
          models.map(async (m) => toModelCard(m, await getModelManifest(m.bucket, m.name, m.version))),
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

/**
 * The connected wallet's on-chain buckets (numeric ids), from the blockchain
 * index — the id an Inference API key bills to. Removed buckets are dropped. The
 * key must be scoped to a bucket the wallet owns, so this is the source for the
 * key panel's bucket picker.
 */
export function useOwnerBuckets(): OwnerBucketsState {
  const account = useAccount();
  const pubkey = account.account ?? null;
  const [buckets, setBuckets] = useState<OwnerBucket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pubkey) {
      setBuckets([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    listOwnerBuckets(pubkey)
      .then((list) => {
        if (!cancelled) setBuckets(list.filter((b) => !b.isRemoved));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not read your buckets.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pubkey]);

  return { buckets, loading, error };
}
