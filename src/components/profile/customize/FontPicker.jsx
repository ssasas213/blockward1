import React from 'react';
import { FONTS } from '@/lib/profileThemes';

// Four curated heading-font pairings — body text always stays clean Inter.
export default function FontPicker({ value, set }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">Heading font</p>
      <p className="text-xs text-muted-foreground">Four curated pairings — your body text always stays clean Inter.</p>
      <div className="grid grid-cols-2 gap-2">
        {FONTS.map((f) => {
          const selected = (value.display_font || 'sans') === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => set({ display_font: f.id })}
              className={`rounded-lg border p-3 text-left transition-colors ${selected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/40'}`}
              aria-pressed={selected}
            >
              <p className="text-lg font-bold text-foreground" style={{ fontFamily: f.heading }}>Ag</p>
              <p className="text-xs font-medium text-foreground">{f.label}</p>
              <p className="text-[10px] text-muted-foreground">{f.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}