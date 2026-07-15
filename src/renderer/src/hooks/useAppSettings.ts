import { useCallback, useEffect, useRef, useState } from 'react';
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

function describeError(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function useAppSettings(): UseAppSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(() => normalizeSettings(DEFAULT_SETTINGS));
  const [systemIsDark, setSystemIsDark] = useState<boolean>(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const preferenceRequestId = useRef(0);
  const featureRequestId = useRef(0);

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
        setError(describeError(err, 'Could not load settings'));
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

  const resyncAfterWriteError = useCallback((err: unknown) => {
    const writeError = describeError(err, 'Could not update settings');
    setError(writeError);
    void window.api
      .getSettings()
      .then((persistedSettings) => {
        setSettings(persistedSettings);
      })
      .catch((reloadErr: unknown) => {
        setError(
          `${writeError}; could not reload settings: ${describeError(
            reloadErr,
            'Could not load settings',
          )}`,
        );
      });
  }, []);

  const setPreference = useCallback(
    (mode: ColorModePreference) => {
      const requestId = ++preferenceRequestId.current;
      setSettings((current) => ({ ...current, colorMode: mode }));
      void window.api
        .setColorMode(mode)
        .then(() => {
          if (requestId === preferenceRequestId.current) setError(undefined);
        })
        .catch((err: unknown) => {
          if (requestId === preferenceRequestId.current) resyncAfterWriteError(err);
        });
    },
    [resyncAfterWriteError],
  );

  const setFeatureEnabled = useCallback(
    (feature: FeatureKey, enabled: boolean) => {
      const requestId = ++featureRequestId.current;
      setSettings((current) => ({
        ...current,
        features: { ...current.features, [feature]: enabled },
      }));
      void window.api
        .setFeatureEnabled(feature, enabled)
        .then(() => {
          if (requestId === featureRequestId.current) setError(undefined);
        })
        .catch((err: unknown) => {
          if (requestId === featureRequestId.current) resyncAfterWriteError(err);
        });
    },
    [resyncAfterWriteError],
  );

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
