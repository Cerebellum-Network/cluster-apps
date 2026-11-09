import { useMutation, useQuery } from '@tanstack/react-query';
import type { CefSigner } from '@cef-ai/wallet';
import { mintInferenceApiKey } from './apiKey';
import {
  getLimits,
  getModelManifest,
  listModelCatalog,
  runInference,
  type InferenceModelRef,
} from './inferenceGatewayApi';

export const modelKeys = {
  catalog: () => ['models', 'catalog'] as const,
  manifest: (bucket: number, name: string, version: string) =>
    ['models', 'manifest', bucket, name, version] as const,
  limits: (key: string) => ['models', 'limits', key] as const,
};

/** The inference gateway's model catalog. Public GET -- no wallet needed. */
export const useModelCatalog = () =>
  useQuery({ queryKey: modelKeys.catalog(), queryFn: listModelCatalog, staleTime: 30_000 });

/** One model version's CDN manifest; fetched lazily (e.g. when a card expands). */
export const useModelManifest = (
  bucket: number,
  name: string,
  version: string,
  enabled: boolean,
) =>
  useQuery({
    queryKey: modelKeys.manifest(bucket, name, version),
    queryFn: () => getModelManifest(bucket, name, version),
    enabled,
    staleTime: 5 * 60_000,
  });

/**
 * Mint an inference API key for a numeric bucket id. The key is shown once and
 * cannot be revoked (stateless), so callers surface a short TTL + warning.
 */
export function useMintApiKey(getSigner: () => CefSigner) {
  return useMutation({
    mutationFn: ({ bucketId, ttlMs }: { bucketId: bigint; ttlMs: number }) =>
      mintInferenceApiKey(getSigner, bucketId, ttlMs),
  });
}

/** Run one inference request (playground). */
export function useRunInference() {
  return useMutation({
    mutationFn: ({ model, inputs, apiKey }: { model: InferenceModelRef; inputs: unknown; apiKey?: string }) =>
      runInference(model, inputs, apiKey),
  });
}

/** The bucket's usage + limits for an API key. */
export const useLimits = (apiKey: string) =>
  useQuery({
    queryKey: modelKeys.limits(apiKey),
    queryFn: () => getLimits(apiKey),
    enabled: !!apiKey,
    staleTime: 10_000,
  });
