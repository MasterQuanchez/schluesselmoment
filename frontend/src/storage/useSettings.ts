import { useCallback, useEffect, useState } from 'react';
import type { Settings } from '@/domain/schema';
import { getSettings, saveSettings } from './db';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);
  const update = useCallback((fn: (s: Settings) => Settings) => {
    setSettings((cur) => {
      if (!cur) return cur;
      const next = fn(cur);
      void saveSettings(next);
      return next;
    });
  }, []);
  return { settings, update };
}
