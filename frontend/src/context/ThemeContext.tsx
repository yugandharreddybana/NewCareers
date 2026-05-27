import React, { createContext, useContext, useEffect, useMemo } from 'react';

export type ThemePreference = 'light';
type ResolvedTheme = 'light';

const THEME_STORAGE_KEY = 'careerops-theme';

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyLightTheme(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('dark');
  root.dataset.theme = 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyLightTheme();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: () => {
        applyLightTheme();
      },
      toggleTheme: () => {
        applyLightTheme();
      },
    }),
    [],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
