import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Resolved = 'light' | 'dark';
type Preference = Resolved | 'system';

interface ThemeModeValue {
  mode: Resolved;
  toggle: () => void;
}

const STORAGE_KEY = 'dragon-billing:theme';
const ThemeModeContext = createContext<ThemeModeValue>({ mode: 'light', toggle: () => {} });

function readPreference(): Preference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemMode(): Resolved {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Follows the OS colour scheme until the user picks one with the toggle;
 * the choice is remembered per browser. Writes `data-theme` on <html>, which
 * switches the --b-* token set in tokens.css.
 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Preference>(readPreference);
  const [system, setSystem] = useState<Resolved>(systemMode);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const mode: Resolved = preference === 'system' ? system : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const value = useMemo<ThemeModeValue>(
    () => ({
      mode,
      toggle: () => {
        const next: Resolved = mode === 'dark' ? 'light' : 'dark';
        setPreference(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* private mode: the choice lasts for this session only */
        }
      },
    }),
    [mode],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export const useThemeMode = () => useContext(ThemeModeContext);
