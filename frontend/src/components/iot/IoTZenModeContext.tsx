'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type IoTZenModeContextValue = {
  zenMode: boolean;
  setZenMode: (value: boolean) => void;
  toggleZenMode: () => void;
};

const STORAGE_KEY = 'cleansight.iot.zen-mode';

const IoTZenModeContext = createContext<IoTZenModeContextValue | null>(null);

export function IoTZenModeProvider({ children }: { children: ReactNode }) {
  const [zenMode, setZenMode] = useState(false);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      if (storedValue != null) {
        setZenMode(storedValue === 'true');
      }
    } catch {
      // Keep the default state when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(zenMode));
    } catch {
      // Ignore storage write failures so the UI keeps working.
    }
  }, [zenMode]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue != null) {
        setZenMode(event.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(
    () => ({
      zenMode,
      setZenMode,
      toggleZenMode: () => setZenMode((current) => !current),
    }),
    [zenMode]
  );

  return <IoTZenModeContext.Provider value={value}>{children}</IoTZenModeContext.Provider>;
}

export function useIoTZenMode() {
  const context = useContext(IoTZenModeContext);
  if (!context) {
    throw new Error('useIoTZenMode must be used within IoTZenModeProvider');
  }
  return context;
}
