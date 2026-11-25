/**
 * Experimental features: off unless switched on. Agents are experimental (the
 * product is sandboxes; agents are a client-side layer over them, too raw to
 * offer by default), so the Agents pages, their nav entry and the pointers to
 * them from other pages show only when the flag is on. The code and routes stay;
 * with the flag on everything works as before.
 *
 * Switched on by any of:
 *   - a deployment: `features: { agents: true }` in `/config.js`
 *     (`window.__RUNTIME_CONFIG__`, mounted by the Helm chart);
 *   - a local run: `VITE_FEATURE_AGENTS=true`;
 *   - one browser: open any page with `?experimental=agents`; it stays on in
 *     that browser until a page is opened with `?experimental=off`.
 */
const STORAGE_KEY = 'developer-console.experimental';

export interface Features {
  agents: boolean;
}

/** The flags from each source, the browser's opt-in last (it can only switch a feature on, or clear itself). */
export function resolveFeatures(src: {
  runtime?: { agents?: boolean };
  env?: string;
  /** `location.search`. */
  search?: string;
  /** What this browser opted into before; null when nothing (or no storage). */
  stored?: string | null;
}): { features: Features; store?: string | null } {
  const param = new URLSearchParams(src.search ?? '').get('experimental');
  let stored = src.stored ?? null;
  let store: string | null | undefined;
  if (param === 'off') store = stored = null;
  else if (param) {
    const set = new Set([...(stored ?? '').split(','), ...param.split(',')].map((x) => x.trim()).filter(Boolean));
    store = stored = [...set].sort().join(',');
  }
  const optedIn = (stored ?? '').split(',').includes('agents');
  return {
    features: { agents: src.runtime?.agents === true || src.env === 'true' || optedIn },
    ...(store !== undefined ? { store } : {}),
  };
}

function load(): Features {
  if (typeof window === 'undefined') return { agents: false };
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    /* no storage: the opt-in lasts this page load only */
  }
  const { features, store } = resolveFeatures({
    runtime: window.__RUNTIME_CONFIG__?.features,
    env: import.meta.env.VITE_FEATURE_AGENTS,
    search: window.location.search,
    stored,
  });
  if (store !== undefined)
    try {
      if (store) window.localStorage.setItem(STORAGE_KEY, store);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* no storage */
    }
  return features;
}

export const features: Features = load();
