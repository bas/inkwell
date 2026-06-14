import { useCallback, useEffect, useState } from 'react';
import type { ColorModePreference } from '@shared/types';

type EffectiveColorMode = 'light' | 'dark';

interface UseColorModeResult {
  /** The user's persisted preference (light / dark / auto). */
  preference: ColorModePreference;
  /** The resolved color mode actually applied to the UI. */
  resolvedMode: EffectiveColorMode;
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
  const [systemIsDark, setSystemIsDark] = useState<boolean>(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
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

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onMediaChange = (event: MediaQueryListEvent): void => setSystemIsDark(event.matches);
    media.addEventListener('change', onMediaChange);
    const unsubscribeIpc = window.api.onSystemColorSchemeChanged((isDark) =>
      setSystemIsDark(isDark),
    );
    return () => {
      media.removeEventListener('change', onMediaChange);
      unsubscribeIpc();
    };
  }, []);

  const setPreference = useCallback((mode: ColorModePreference) => {
    setPreferenceState(mode);
    void window.api.setColorMode(mode);
  }, []);

  const resolvedMode: EffectiveColorMode =
    preference === 'auto' ? (systemIsDark ? 'dark' : 'light') : preference;

  return { preference, resolvedMode, loaded, setPreference };
}

/** Maps the resolved app mode to Primer's `ThemeProvider` `colorMode` prop. */
export function toPrimerColorMode(mode: EffectiveColorMode): 'day' | 'night' {
  return mode === 'dark' ? 'night' : 'day';
}
