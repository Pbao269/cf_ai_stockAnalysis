'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-10 w-10">
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="h-10 w-10 shadow-elevated hover-lift"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      title={`Current: ${theme}, Click for: ${isDark ? 'light' : 'dark'}`}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
