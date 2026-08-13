import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { getStoredTheme, applyTheme } from '@/lib/themeManager';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'system', label: 'System', icon: Monitor },
];

// Default export: fragment of menu items + label, used INSIDE another dropdown (profile menu).
export default function ThemeToggle() {
  const [theme, setThemeState] = useState('system');
  useEffect(() => { setThemeState(getStoredTheme()); }, []);
  const choose = (t) => { applyTheme(t); setThemeState(t); };

  return (
    <>
      <DropdownMenuLabel className="text-[11px] text-tertiary uppercase tracking-wider">
        Appearance
      </DropdownMenuLabel>
      {OPTIONS.map((opt) => (
        <DropdownMenuItem key={opt.key} onClick={() => choose(opt.key)} className="cursor-pointer flex items-center gap-2">
          <opt.icon className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm">{opt.label}</span>
          {theme === opt.key && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
    </>
  );
}

// Standalone compact toggle with an icon trigger — for top bars.
export function ThemeToggleCompact({ className }) {
  const [theme, setThemeState] = useState('system');
  useEffect(() => { setThemeState(getStoredTheme()); }, []);
  const choose = (t) => { applyTheme(t); setThemeState(t); };
  const ActiveIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Toggle theme"
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-hover hover:text-foreground transition-colors",
            className
          )}
        >
          <ActiveIcon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-[11px] text-tertiary uppercase tracking-wider">Appearance</DropdownMenuLabel>
        {OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.key} onClick={() => choose(opt.key)} className="cursor-pointer flex items-center gap-2">
            <opt.icon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm">{opt.label}</span>
            {theme === opt.key && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}