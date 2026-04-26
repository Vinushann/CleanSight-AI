'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type AccessibilityFontSize = 'small' | 'medium' | 'large';

export interface AccessibilityPreferences {
  highContrast: boolean;
  fontSize: AccessibilityFontSize;
  iconTextLabels: boolean;
  colorBlindFriendly: boolean;
  reduceMotion: boolean;
}

interface AccessibilityContextValue {
  preferences: AccessibilityPreferences;
  updatePreference: <Key extends keyof AccessibilityPreferences>(
    key: Key,
    value: AccessibilityPreferences[Key]
  ) => void;
}

const STORAGE_KEY = 'cleansight-accessibility-preferences';

const defaultPreferences: AccessibilityPreferences = {
  highContrast: false,
  fontSize: 'medium',
  iconTextLabels: false,
  colorBlindFriendly: false,
  reduceMotion: false,
};

const fontSizes: AccessibilityFontSize[] = ['small', 'medium', 'large'];

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined);

function readStoredPreferences(): AccessibilityPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultPreferences;

    const parsed = JSON.parse(stored) as Partial<AccessibilityPreferences>;
    return {
      highContrast: parsed.highContrast === true,
      fontSize: parsed.fontSize && fontSizes.includes(parsed.fontSize) ? parsed.fontSize : 'medium',
      iconTextLabels: parsed.iconTextLabels === true,
      colorBlindFriendly: parsed.colorBlindFriendly === true,
      reduceMotion: parsed.reduceMotion === true,
    };
  } catch {
    return defaultPreferences;
  }
}

function applyPreferences(preferences: AccessibilityPreferences) {
  const root = document.documentElement;

  root.dataset.highContrast = String(preferences.highContrast);
  root.dataset.fontSize = preferences.fontSize;
  root.dataset.iconTextLabels = String(preferences.iconTextLabels);
  root.dataset.colorBlindFriendly = String(preferences.colorBlindFriendly);
  root.dataset.reduceMotion = String(preferences.reduceMotion);
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(defaultPreferences);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedPreferences = readStoredPreferences();
    setPreferences(storedPreferences);
    applyPreferences(storedPreferences);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    applyPreferences(preferences);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences, mounted]);

  const updatePreference = <Key extends keyof AccessibilityPreferences>(
    key: Key,
    value: AccessibilityPreferences[Key]
  ) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  return (
    <AccessibilityContext.Provider value={{ preferences, updatePreference }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);

  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }

  return context;
}
