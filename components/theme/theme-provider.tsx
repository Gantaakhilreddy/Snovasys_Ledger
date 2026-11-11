'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to 'light' for clean institutional presentation on first load
  const [theme, setThemeState] = useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read persisted theme from localStorage; default strictly to 'light' for first-time visitors
    const saved = localStorage.getItem('ledgerline-theme') as Theme | null;
    const initialTheme: Theme = saved || 'light';
    setThemeState(initialTheme);

    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    const computeResolved = (t: Theme): 'light' | 'dark' => {
      if (t === 'system') {
        return mql.matches ? 'dark' : 'light';
      }
      return t === 'dark' ? 'dark' : 'light';
    };

    const applyTheme = (t: Theme) => {
      const resolved = computeResolved(t);
      setResolvedTheme(resolved);

      const root = document.documentElement;
      if (resolved === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        root.setAttribute('data-theme', 'dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
        root.style.colorScheme = 'light';
      }
    };

    applyTheme(initialTheme);
    setMounted(true);

    const handleSystemChange = () => {
      const curSaved = localStorage.getItem('ledgerline-theme');
      if (curSaved === 'system') {
        applyTheme('system');
      }
    };

    mql.addEventListener('change', handleSystemChange);
    return () => mql.removeEventListener('change', handleSystemChange);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('ledgerline-theme', newTheme);
    } catch {}

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const resolved =
      newTheme === 'system'
        ? (mql.matches ? 'dark' : 'light')
        : (newTheme === 'dark' ? 'dark' : 'light');
    setResolvedTheme(resolved);

    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  };

  const toggleTheme = () => {
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
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

