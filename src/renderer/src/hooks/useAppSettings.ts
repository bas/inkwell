import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiModelInfo } from '@shared/ai';
import type { AppSettings, ColorModePreference, FeatureKey } from '@shared/types';
import { DEFAULT_SETTINGS, normalizeSettings } from '@shared/types';

type EffectiveColorMode = 'light' | 'dark';

interface UseAppSettingsResult {
  settings: AppSettings;
  aiModels: AiModelInfo[];
  aiModelsLoading: boolean;
  aiModelsError: string | undefined;
  preference: ColorModePreference;
  resolvedMode: EffectiveColorMode;
  loaded: boolean;
  error: string | undefined;
  setPreference: (mode: ColorModePreference) => void;
  setFeatureEnabled: (feature: FeatureKey, enabled: boolean) => void;
  setAiModelPreference: (model: AppSettings['aiModel']) => void;
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
  const [aiModels, setAiModels] = useState<AiModelInfo[]>([]);
  const [aiModelsLoading, setAiModelsLoading] = useState(false);
  const [aiModelsError, setAiModelsError] = useState<string | undefined>(undefined);
  const preferenceRequestId = useRef(0);
  const featureRequestId = useRef(0);
  const aiModelRequestId = useRef(0);

  useEffect(() => {
    let active = true;
    const preferenceRequestAtLoadStart = preferenceRequestId.current;
    const featureRequestAtLoadStart = featureRequestId.current;
    const aiModelRequestAtLoadStart = aiModelRequestId.current;
    const loadIsCurrent = (): boolean =>
      preferenceRequestAtLoadStart === preferenceRequestId.current &&
      featureRequestAtLoadStart === featureRequestId.current &&
      aiModelRequestAtLoadStart === aiModelRequestId.current;

    window.api
      .getSettings()
      .then((loadedSettings) => {
        if (!active) return;
        if (loadIsCurrent()) {
          setSettings(loadedSettings);
          setError(undefined);
        }
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoaded(true);
        if (loadIsCurrent()) setError(describeError(err, 'Could not load settings'));
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

  useEffect(() => {
    let active = true;
    setAiModelsLoading(true);
    setAiModelsError(undefined);
    window.api
      .listAiModels()
      .then((result) => {
        if (!active) return;
        setAiModels(result.models);
        setAiModelsError(result.error);
        setAiModelsLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setAiModels([]);
        setAiModelsError(describeError(err, 'Could not load available AI models'));
        setAiModelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const resyncAfterWriteError = useCallback((err: unknown) => {
    const writeError = describeError(err, 'Could not update settings');
    const preferenceRequestAtResyncStart = preferenceRequestId.current;
    const featureRequestAtResyncStart = featureRequestId.current;
    const aiModelRequestAtResyncStart = aiModelRequestId.current;
    const resyncIsCurrent = (): boolean =>
      preferenceRequestAtResyncStart === preferenceRequestId.current &&
      featureRequestAtResyncStart === featureRequestId.current &&
      aiModelRequestAtResyncStart === aiModelRequestId.current;

    setError(writeError);
    void window.api
      .getSettings()
      .then((persistedSettings) => {
        if (!resyncIsCurrent()) return;
        setSettings(persistedSettings);
      })
      .catch((reloadErr: unknown) => {
        if (!resyncIsCurrent()) return;
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

  const setAiModelPreference = useCallback(
    (model: AppSettings['aiModel']) => {
      const requestId = ++aiModelRequestId.current;
      setSettings((current) => ({ ...current, aiModel: model }));
      void window.api
        .setAiModelPreference(model)
        .then(() => {
          if (requestId === aiModelRequestId.current) setError(undefined);
        })
        .catch((err: unknown) => {
          if (requestId === aiModelRequestId.current) {
            resyncAfterWriteError(err);
          }
        });
    },
    [resyncAfterWriteError],
  );

  const preference = settings.colorMode;
  const resolvedMode: EffectiveColorMode =
    preference === 'auto' ? (systemIsDark ? 'dark' : 'light') : preference;

  return {
    settings,
    aiModels,
    aiModelsLoading,
    aiModelsError,
    preference,
    resolvedMode,
    loaded,
    error,
    setPreference,
    setFeatureEnabled,
    setAiModelPreference,
  };
}

/** Maps the resolved app mode to Primer's `ThemeProvider` `colorMode` prop. */
export function toPrimerColorMode(mode: EffectiveColorMode): 'day' | 'night' {
  return mode === 'dark' ? 'night' : 'day';
}
