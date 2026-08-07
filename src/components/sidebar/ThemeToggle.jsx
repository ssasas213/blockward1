import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import {
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { getStoredTheme, applyTheme } from '@/lib/themeManager';

const OPTIONS = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'system', label: 'System', icon: Monitor },
];

export default function ThemeToggle() {
  const [theme, setThemeState] = useState('system');

  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);

  const choose = (t) => {
    applyTheme(t);
    setThemeState(t);
  };

  return (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
        Theme
      </DropdownMenuLabel>
      {OPTIONS.map((opt) => (
        <DropdownMenuItem
          key={opt.key}
          onClick={() => choose(opt.key)}
          className="cursor-pointer flex items-center gap-2"
        >
          <opt.icon className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm">{opt.label}</span>
          {theme === opt.key && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
    </>
  );
}