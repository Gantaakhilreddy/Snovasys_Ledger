'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from './theme-provider';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`w-9 h-9 rounded-xl bg-surface-container-low border border-surface-container-high ${className}`} />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all duration-200 cursor-pointer select-none
        ${
          isDark
            ? 'bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-slate-700 shadow-[0_0_15px_-3px_rgba(251,191,36,0.15)] hover:shadow-[0_0_20px_-2px_rgba(251,191,36,0.25)]'
            : 'bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 shadow-xs hover:shadow-sm'
        } ${className}`}
    >
      <div className="relative w-5 h-5 flex items-center justify-center overflow-hidden">
        {/* Sun Icon (shown in dark mode to switch to light) */}
        <span
          className={`material-symbols-outlined text-[20px] transition-all duration-300 transform ${
            isDark
              ? 'opacity-100 rotate-0 scale-100 text-amber-400'
              : 'opacity-0 -rotate-90 scale-50 absolute text-amber-500'
          }`}
        >
          light_mode
        </span>

        {/* Moon Icon (shown in light mode to switch to dark) */}
        <span
          className={`material-symbols-outlined text-[20px] transition-all duration-300 transform ${
            isDark
              ? 'opacity-0 rotate-90 scale-50 absolute text-slate-400'
              : 'opacity-100 rotate-0 scale-100 text-indigo-600'
          }`}
        >
          dark_mode
        </span>
      </div>

      {showLabel && (
        <span className="text-xs font-semibold tracking-wide font-mono pr-1">
          {isDark ? 'LIGHT' : 'DARK'}
        </span>
      )}
    </button>
  );
}

