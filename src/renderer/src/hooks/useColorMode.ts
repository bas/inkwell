import { useCallback, useEffect, useState } from 'react';
import type { ColorModePreference } from '@shared/types';

interface UseColorModeResult {
  /** The user's persisted preference (light / dark / auto). */
  preference: ColorModePreference;
  /** Whether the preference has finished loading from the main process. */
  loaded: boolean;
  setPreference: (mode: ColorModePreference) => void;
}

/**
 * Loads and persists the color-mode preference via the main process.
 * The actual light/dark resolution for `auto` is handled by Primer's
 * `ThemeProvider colorMode="auto"`, which follows the system appearance.
 */
export function useColorMode(): UseColorModeResult {
  const [preference, setPreferenceState] = useState<ColorModePreference>('auto');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    window.api
      .getSettings()
      .then((settings) => {
        if (active) {
          setPreferenceState(settings.colorMode);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((mode: ColorModePreference) => {
    setPreferenceState(mode);
    void window.api.setColorMode(mode);
  }, []);

  return { preference, loaded, setPreference };
}

/** Maps our preference to Primer's `ThemeProvider` `colorMode` prop. */
export function toPrimerColorMode(preference: ColorModePreference): 'day' | 'night' | 'auto' {
  if (preference === 'light') return 'day';
  if (preference === 'dark') return 'night';
  return 'auto';
}
