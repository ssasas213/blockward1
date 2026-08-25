import React, { useState } from 'react';
import { Sun, Moon, Monitor, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyTheme } from '@/lib/themeManager';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function AppearanceSettings({ profile, onPreferenceChange }) {
  const current = profile?.theme_preference || 'system';
  const [saving, setSaving] = useState(null);
  const [mascotOn, setMascotOn] = useState(profile?.show_mascot_on_signin === true);
  const [mascotSaving, setMascotSaving] = useState(false);

  const select = async (value) => {
    // Apply immediately — no flash, no reload
    applyTheme(value);
    setSaving(value);
    try {
      if (profile?.id) {
        await import('@/api/base44Client').then(async ({ base44 }) => {
          const res = await base44.functions.invoke('updateMyProfile', { theme_preference: value });
          const data = res.data || res;
          if (data?.error) throw new Error(data.error);
        });
      }
      if (onPreferenceChange) onPreferenceChange(value);
    } catch {
      toast.error('Failed to save theme preference');
    } finally {
      setSaving(null);
    }
  };

  const toggleMascot = async (checked) => {
    setMascotOn(checked);
    setMascotSaving(true);
    try {
      if (profile?.id) {
        await import('@/api/base44Client').then(async ({ base44 }) => {
          const res = await base44.functions.invoke('updateMyProfile', { show_mascot_on_signin: checked });
          const data = res.data || res;
          if (data?.error) throw new Error(data.error);
        });
        toast.success(checked ? 'Mascot will show on every sign-in' : 'Mascot set to first-time only');
      }
    } catch {
      setMascotOn(!checked);
      toast.error('Failed to save preference');
    } finally {
      setMascotSaving(false);
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

      <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-muted/20">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Show mascot on every sign-in</p>
            <p className="text-xs text-muted-foreground">Launch the BlockWard welcome tour each time you sign in.</p>
          </div>
        </div>
        <Switch
          checked={mascotOn}
          onCheckedChange={toggleMascot}
          disabled={mascotSaving}
          aria-label="Show mascot on every sign-in"
        />
      </div>
    </div>
  );
}