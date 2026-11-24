/**
 * The console's COMPUTE token for one bucket: the DDC access token every
 * compute-gateway route (sandboxes, agents) and the inference gateway's usage
 * reads take as `Authorization: Bearer`.
 *
 *   - cached per (account, bucket) in localStorage until it nearly expires
 *     (inference/usageToken.ts), so the wallet is asked once a day, not on
 *     every visit, and Inference → Usage and Sandboxes share it;
 *   - minted on mount when none is cached (the wallet shows its own consent),
 *     with one mint per (account, bucket) in flight across the app, so React's
 *     double-run effects never pop the wallet twice;
 *   - re-minted once when a gateway rejects it (`onAuthError`); a token
 *     rejected soon after it was minted is an error, not a loop of prompts.
 *
 * It is a 24h bearer for the bucket, cleared on sign-out (wallet/session.tsx).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAccount } from '~/hooks';
import { dropUsageToken, readUsageToken, USAGE_TOKEN_TTL_MS, writeUsageToken } from '~/inference/usageToken';

export type ComputeToken =
  | { kind: 'minting' }
  | { kind: 'ready'; key: string }
  | { kind: 'error'; message: string; detail: string };

/** What each consumer shows when minting fails or the gateway keeps refusing. */
export interface TokenMessages {
  mintFailed: string;
  rejected: string;
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

const inFlight = new Map<string, Promise<string>>();

/** A token rejected within this long of its mint is not re-minted again. */
const FRESH_MS = 10 * 60 * 1000;

export function useComputeToken(
  bucketId: string | null,
  messages: TokenMessages,
): { state: ComputeToken; onAuthError: () => void; retry: () => void } {
  const account = useAccount();
  const accountRef = useRef(account);
  accountRef.current = account;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const owner = account.account;
  /** Which (account, bucket) the state is for: another's token is never handed out, not even for one render. */
  const source = `${owner}:${bucketId}`;
  const [tagged, setTagged] = useState<{ for: string; value: ComputeToken }>({ for: source, value: { kind: 'minting' } });
  const setState = useCallback((value: ComputeToken) => setTagged({ for: source, value }), [source]);
  const [attempt, setAttempt] = useState(0);
  /** When this hook last minted: a token rejected soon after is not stale, the gateway is refusing it. */
  const mintedAt = useRef(0);

  useEffect(() => {
    if (!bucketId || !owner) return undefined;
    let dead = false;
    const cached = readUsageToken(owner, bucketId);
    if (cached) {
      setState({ kind: 'ready', key: cached });
      return undefined;
    }
    setState({ kind: 'minting' });
    const id = `${owner}:${bucketId}`;
    let mint = inFlight.get(id);
    if (!mint) {
      const expiresAt = Date.now() + USAGE_TOKEN_TTL_MS;
      mintedAt.current = Date.now();
      mint = accountRef.current.createInferenceApiKey(BigInt(bucketId), USAGE_TOKEN_TTL_MS).then((token) => {
        writeUsageToken(owner, bucketId, token, expiresAt);
        return token;
      });
      inFlight.set(id, mint);
      const clear = () => inFlight.delete(id);
      mint.then(clear, clear);
    }
    mint.then(
      (key) => {
        if (!dead) setState({ kind: 'ready', key });
      },
      (e: unknown) => {
        if (!dead) setState({ kind: 'error', message: messagesRef.current.mintFailed, detail: messageOf(e) });
      },
    );
    return () => {
      dead = true;
    };
  }, [owner, bucketId, attempt, setState]);

  const onAuthError = useCallback(() => {
    if (!bucketId || !owner) return;
    dropUsageToken(owner, bucketId);
    if (Date.now() - mintedAt.current < FRESH_MS) {
      setState({
        kind: 'error',
        message: messagesRef.current.rejected,
        detail: 'The gateway rejected a freshly minted token.',
      });
      return;
    }
    setAttempt((n) => n + 1);
  }, [owner, bucketId, setState]);

  const retry = useCallback(() => {
    mintedAt.current = 0;
    setAttempt((n) => n + 1);
  }, []);

  const state: ComputeToken = tagged.for === source ? tagged.value : { kind: 'minting' };
  return { state, onAuthError, retry };
}
