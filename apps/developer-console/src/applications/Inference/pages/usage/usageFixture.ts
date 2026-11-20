/**
 * Sample data for the Usage page's render test: two models used over 24h,
 * one of them refused at the account's limit. Shaped exactly as loadUsage
 * returns it.
 */
import type { Series } from '~/inference/metricsApi';
import type { UsageData } from '~/inference/useUsage';
import { usageWindow } from '~/inference/usageMath';

const NOW = Date.UTC(2026, 10, 20, 12, 0);
const window = usageWindow('24h', NOW);

const perBar = (model: string, f: (i: number) => number): Series => {
  const points: Array<[number, number]> = [];
  for (let t = window.fromMs + window.barMs, i = 0; t <= window.toMs; t += window.barMs, i++) points.push([t, f(i)]);
  return { labels: { model }, points };
};

const M = (o: Record<string, number>) => new Map(Object.entries(o));

export const usageFixture: UsageData = {
  window,
  reads: {
    gpu: M({ 'glm-5.3': 412.5, 'qwen3-embed': 3.2 }),
    requests: M({ 'glm-5.3': 1840, 'qwen3-embed': 96 }),
    tokensIn: M({ 'glm-5.3': 2_400_000, 'qwen3-embed': 81_000 }),
    tokensCached: M({ 'glm-5.3': 600_000 }),
    tokensOut: M({ 'glm-5.3': 310_000 }),
    peak: M({ 'glm-5.3': 8, 'qwen3-embed': 2 }),
    limits: M({ 'glm-5.3': 8, 'qwen3-embed': 8, 'never-used': 8 }),
    refusedLimit: M({ 'glm-5.3': 37 }),
    refusedFull: M({ 'glm-5.3': 4 }),
    prev: { gpu: M({ 'glm-5.3': 300 }), requests: M({ 'glm-5.3': 1500 }), refused: M({}), peak: M({ 'glm-5.3': 5 }) },
  },
  fallbackLimits: new Map(),
  tokensAvailable: true,
  gpuSteps: [perBar('glm-5.3', (i) => (i % 7) * 0.9), perBar('qwen3-embed', (i) => (i % 3) * 0.01)],
  requestSteps: [perBar('glm-5.3', (i) => (i % 7) * 4), perBar('qwen3-embed', (i) => i % 2)],
};
