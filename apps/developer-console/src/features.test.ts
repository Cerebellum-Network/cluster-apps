import { describe, expect, it } from 'vitest';

import { resolveFeatures } from './features';

describe('resolveFeatures', () => {
  it('keeps agents off by default', () => {
    expect(resolveFeatures({}).features).toEqual({ agents: false });
    expect(resolveFeatures({ env: 'false', search: '?tab=x' })).toEqual({ features: { agents: false } });
  });

  it('turns agents on from /config.js, the env, or this browser’s opt-in', () => {
    expect(resolveFeatures({ runtime: { agents: true } }).features.agents).toBe(true);
    expect(resolveFeatures({ env: 'true' }).features.agents).toBe(true);
    expect(resolveFeatures({ stored: 'agents' }).features.agents).toBe(true);
  });

  it('remembers ?experimental=agents and forgets it with ?experimental=off', () => {
    expect(resolveFeatures({ search: '?experimental=agents' })).toEqual({
      features: { agents: true },
      store: 'agents',
    });
    expect(resolveFeatures({ search: '?experimental=off', stored: 'agents' })).toEqual({
      features: { agents: false },
      store: null,
    });
    // The opt-in never switches off what the deployment switched on.
    expect(resolveFeatures({ search: '?experimental=off', runtime: { agents: true } }).features.agents).toBe(true);
  });
});
