'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'vegetables-shop-theme';

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;

  return 'light';
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <button
      type="button"
      onClick={handleToggleTheme}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[hsl(142_76%_36%)]/20 bg-white text-gray-900 shadow-sm transition hover:border-[hsl(142_76%_36%)] hover:bg-[hsl(142_76%_36%)]/5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:h-11 sm:w-11"
      aria-label={theme === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 text-white" />
      ) : (
        <Moon className="h-5 w-5 text-zinc-700" />
      )}
    </button>
  );
}

