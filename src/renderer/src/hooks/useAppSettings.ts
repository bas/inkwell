import { useCallback, useEffect, useState } from 'react';
import type { AppSettings, ColorModePreference, FeatureKey } from '@shared/types';
import { DEFAULT_SETTINGS, normalizeSettings } from '@shared/types';

type EffectiveColorMode = 'light' | 'dark';

interface UseAppSettingsResult {
  settings: AppSettings;
  preference: ColorModePreference;
  resolvedMode: EffectiveColorMode;
  loaded: boolean;
  error: string | undefined;
  setPreference: (mode: ColorModePreference) => void;
  setFeatureEnabled: (feature: FeatureKey, enabled: boolean) => void;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Could not update settings';
}

export function useAppSettings(): UseAppSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(() => normalizeSettings(DEFAULT_SETTINGS));
  const [systemIsDark, setSystemIsDark] = useState<boolean>(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    window.api
      .getSettings()
      .then((loadedSettings) => {
        if (!active) return;
        setSettings(loadedSettings);
        setLoaded(true);
        setError(undefined);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoaded(true);
        setError(describeError(err));
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
    setSettings((current) => ({ ...current, colorMode: mode }));
    void window.api
      .setColorMode(mode)
      .then((next) => {
        setSettings(next);
        setError(undefined);
      })
      .catch((err: unknown) => setError(describeError(err)));
  }, []);

  const setFeatureEnabled = useCallback((feature: FeatureKey, enabled: boolean) => {
    setSettings((current) => ({
      ...current,
      features: { ...current.features, [feature]: enabled },
    }));
    void window.api
      .setFeatureEnabled(feature, enabled)
      .then((next) => {
        setSettings(next);
        setError(undefined);
      })
      .catch((err: unknown) => setError(describeError(err)));
  }, []);

  const preference = settings.colorMode;
  const resolvedMode: EffectiveColorMode =
    preference === 'auto' ? (systemIsDark ? 'dark' : 'light') : preference;

  return {
    settings,
    preference,
    resolvedMode,
    loaded,
    error,
    setPreference,
    setFeatureEnabled,
  };
}

/** Maps the resolved app mode to Primer's `ThemeProvider` `colorMode` prop. */
export function toPrimerColorMode(mode: EffectiveColorMode): 'day' | 'night' {
  return mode === 'dark' ? 'night' : 'day';
}
