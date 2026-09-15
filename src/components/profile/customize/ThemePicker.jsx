import React from 'react';
import { Check } from 'lucide-react';
import { THEMES } from '@/lib/profileThemes';

// The 10 designed themes — every one stays credible for employers and
// admissions officers.
export default function ThemePicker({ value, set }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">Theme</p>
      <p className="text-xs text-muted-foreground">A designed look for your whole profile.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {THEMES.map((t) => {
          const selected = (value.theme_id || 'slate') === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => set({ theme_id: t.id })}
              className={`relative rounded-lg border p-2 text-left transition-colors ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-border bg-background hover:border-primary/40'}`}
              style={{ background: t.preview.bg }}
              aria-pressed={selected}
            >
              <div className="h-6 rounded" style={{ background: t.banner }} />
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-sm border border-border" style={{ background: t.preview.card }} />
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: t.preview.accent }} />
              </div>
              <p className="mt-1.5 text-xs font-semibold" style={{ color: t.preview.text }}>{t.label}</p>
              <p className="text-[10px]" style={{ color: t.preview.text, opacity: 0.65 }}>{t.desc}</p>
              {selected && (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}