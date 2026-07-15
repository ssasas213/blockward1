import React, { useState } from 'react';
import { Sun, Moon, Monitor, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyTheme } from '@/lib/themeManager';
import { toast } from 'sonner';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function AppearanceSettings({ profile, onPreferenceChange }) {
  const current = profile?.theme_preference || 'system';
  const [saving, setSaving] = useState(null);

  const select = async (value) => {
    // Apply immediately — no flash, no reload
    applyTheme(value);
    setSaving(value);
    try {
      if (profile?.id) {
        await import('@/api/base44Client').then(({ base44 }) =>
          base44.entities.UserProfile.update(profile.id, { theme_preference: value })
        );
      }
      if (onPreferenceChange) onPreferenceChange(value);
    } catch {
      toast.error('Failed to save theme preference');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-foreground mb-0.5">Appearance</h3>
        <p className="text-xs text-muted-foreground">Choose how BlockWard looks. Applies instantly across the entire app.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(opt => {
          const Icon = opt.icon;
          const isActive = current === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              disabled={saving !== null}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                isActive
                  ? 'border-primary bg-primary/10 text-primary glow-primary'
                  : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/30 hover:border-border'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm font-medium">{opt.label}</span>
              {saving === opt.value && <Loader2 className="h-3 w-3 animate-spin" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}