import { describe, it, expect } from 'vitest';

import {
  toSeries,
  nameOf,
  chunkRange,
  mergeSeries,
  RANGE_QUERY_MAX_MS,
} from './metricsApi';

describe('toSeries', () => {
  it('parses a range result, epoch seconds → ms', () => {
    const body = {
      data: {
        result: [
          { metric: { model: 'glm-5.3' }, values: [[1700000000, '1'], [1700000900, '2']] },
        ],
      },
    };
    expect(toSeries(body)).toEqual([
      { labels: { model: 'glm-5.3' }, points: [[1700000000000, 1], [1700000900000, 2]] },
    ]);
  });

  it('parses an instant result (single value)', () => {
    const body = { data: { result: [{ metric: { reason: 'saturated' }, value: [1700000000, '3'] }] } };
    expect(toSeries(body)).toEqual([{ labels: { reason: 'saturated' }, points: [[1700000000000, 3]] }]);
  });

  it('is empty for a missing/empty body', () => {
    expect(toSeries(null)).toEqual([]);
    expect(toSeries({})).toEqual([]);
    expect(toSeries({ data: { result: [] } })).toEqual([]);
  });
});

describe('nameOf', () => {
  it('takes the name out of bucket/name/version', () => {
    expect(nameOf('1338/glm-5.3/v1.0.0')).toBe('glm-5.3');
  });
  it('leaves a bare name alone', () => {
    expect(nameOf('parakeet-tdt-0.6b-v2')).toBe('parakeet-tdt-0.6b-v2');
  });
});

describe('chunkRange', () => {
  const DAY = RANGE_QUERY_MAX_MS; // 24h
  const STEP = 900_000; // 15m

  it('is one chunk when the span fits', () => {
    expect(chunkRange(0, DAY, DAY, STEP)).toEqual([{ from: 0, to: DAY }]);
  });

  it('splits 7d into 7 chunks, no sample read twice', () => {
    const chunks = chunkRange(0, 7 * DAY, DAY, STEP);
    expect(chunks).toHaveLength(7);
    expect(chunks[0]).toEqual({ from: 0, to: DAY });
    // each chunk starts one step past the previous end
    for (let i = 1; i < chunks.length; i++) expect(chunks[i].from).toBe(chunks[i - 1].to + STEP);
    expect(chunks[chunks.length - 1].to).toBe(7 * DAY);
  });
});

describe('mergeSeries', () => {
  it('joins chunks by labels, dedupes repeated timestamps, sorts by time', () => {
    const a = [{ labels: { model: 'glm' }, points: [[2, 2] as [number, number], [1, 1] as [number, number]] }];
    const b = [
      { labels: { model: 'glm' }, points: [[2, 9] as [number, number], [3, 3] as [number, number]] },
      { labels: { model: 'par' }, points: [[1, 5] as [number, number]] },
    ];
    const merged = mergeSeries([a, b]);
    const glm = merged.find((s) => s.labels.model === 'glm')!;
    // repeated t=2 keeps the last chunk's sample; points time-ordered
    expect(glm.points).toEqual([[1, 1], [2, 9], [3, 3]]);
    expect(merged.find((s) => s.labels.model === 'par')!.points).toEqual([[1, 5]]);
  });
});
