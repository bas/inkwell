import { useCallback, useEffect, useState } from 'react';
import type { AppFeatures, AppSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/types';

interface UseSettingsResult {
  settings: AppSettings;
  loaded: boolean;
  setFeatures: (features: Partial<AppFeatures>) => void;
}

/**
 * Loads app settings from the main process and exposes typed mutators.
 * Defaults are applied immediately so the UI renders without waiting for the IPC round-trip.
 */
export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    window.api
      .getSettings()
      .then((s) => {
        if (active) {
          setSettings(s);
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

  const setFeatures = useCallback((features: Partial<AppFeatures>) => {
    void window.api.setFeatures(features).then((updated) => {
      setSettings(updated);
    });
  }, []);

  return { settings, loaded, setFeatures };
}
