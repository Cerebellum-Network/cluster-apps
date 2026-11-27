/**
 * Agent definitions for the Agents pages, read from the wallet's buckets
 * through the DDC S3 gateway (agentStore.ts). The bucket names come from the
 * account store (gateway ListBuckets); components pass them in so a MobX
 * observer re-reads when they change.
 */
import { useCallback, useEffect, useState } from 'react';

import { useAccount } from '~/hooks';
import { listAgents, type StoredAgent } from './agentStore';
import { errorMessage } from './client';

export interface AgentDefinitions {
  agents: StoredAgent[];
  /** Buckets that could not be listed. */
  failed: { bucket: string; error: string }[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAgentDefinitions(buckets: string[] | undefined): AgentDefinitions {
  const account = useAccount();
  const key = (buckets ?? []).join(',');
  const [state, setState] = useState<Omit<AgentDefinitions, 'reload'> & { key: string | null }>({
    key: null,
    agents: [],
    failed: [],
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!buckets) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    listAgents(account.storage, buckets)
      .then(({ agents, failed }) => {
        if (alive) setState({ key, agents, failed, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (alive) setState((s) => ({ ...s, key, loading: false, error: errorMessage(e) }));
      });
    return () => {
      alive = false;
    };
    // `key` carries the bucket list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, key, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  if (!buckets) return { agents: [], failed: [], loading: true, error: null, reload };
  return {
    agents: state.agents,
    failed: state.failed,
    loading: state.loading || state.key !== key,
    error: state.error,
    reload,
  };
}
