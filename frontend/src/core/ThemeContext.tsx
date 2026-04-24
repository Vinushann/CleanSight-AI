'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeKey = 'clean-minimal' | 'analytical' | 'dark-technical';

export interface ThemeOption {
  key: ThemeKey;
  label: string;
  description: string;
}

export const themeOptions: ThemeOption[] = [
  { key: 'clean-minimal', label: 'Clean Minimal', description: 'Soft, elegant, presentation-ready' },
  { key: 'analytical', label: 'Analytical', description: 'Structured, decision-focused' },
  { key: 'dark-technical', label: 'Dark Technical', description: 'High contrast monitoring' },
];

interface ThemeContextValue {
  theme: ThemeKey;
  setTheme: (theme: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'cleansight-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>('clean-minimal');
  const [mounted, setMounted] = useState(false);

  // Read from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeKey | null;
    if (stored && themeOptions.some(t => t.key === stored)) {
      setThemeState(stored);
    }
    setMounted(true);
  }, []);

  // Apply data-theme attribute & persist
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, mounted]);

  const setTheme = (newTheme: ThemeKey) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {mounted ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
