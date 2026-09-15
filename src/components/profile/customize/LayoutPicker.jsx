import React from 'react';
import { LAYOUTS, HIGHLIGHT_STYLES } from '@/lib/profileThemes';
import ChoiceGrid from '@/components/profile/customize/ChoiceGrid';

// How the verified achievements and pinned highlights are presented.
export default function LayoutPicker({ value, set }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Achievement layout</p>
        <div className="grid grid-cols-3 gap-2">
          {LAYOUTS.map((l) => {
            const selected = (value.profile_layout || 'grid') === l.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => set({ profile_layout: l.id })}
                className={`rounded-lg border p-3 text-center transition-colors ${selected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/40'}`}
                aria-pressed={selected}
              >
                {l.id === 'grid' && (
                  <div className="mx-auto grid w-12 grid-cols-3 gap-0.5">
                    {Array.from({ length: 6 }).map((_, i) => <span key={i} className={`h-2.5 rounded-sm ${selected ? 'bg-primary/60' : 'bg-muted-foreground/40'}`} />)}
                  </div>
                )}
                {l.id === 'list' && (
                  <div className="mx-auto flex w-12 flex-col gap-1">
                    {Array.from({ length: 3 }).map((_, i) => <span key={i} className={`h-2.5 w-full rounded-sm ${selected ? 'bg-primary/60' : 'bg-muted-foreground/40'}`} />)}
                  </div>
                )}
                {l.id === 'showcase' && (
                  <div className="mx-auto flex w-12 flex-col gap-0.5">
                    <span className={`h-4 w-full rounded-sm ${selected ? 'bg-primary/60' : 'bg-muted-foreground/40'}`} />
                    <div className="grid grid-cols-3 gap-0.5">
                      {Array.from({ length: 3 }).map((_, i) => <span key={i} className={`h-2.5 rounded-sm ${selected ? 'bg-primary/40' : 'bg-muted-foreground/30'}`} />)}
                    </div>
                  </div>
                )}
                <p className="mt-2 text-xs font-semibold text-foreground">{l.label}</p>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{LAYOUTS.find((l) => l.id === value.profile_layout)?.desc}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Highlights style</p>
        <p className="text-xs text-muted-foreground">How your pinned achievements appear at the top.</p>
        <ChoiceGrid options={HIGHLIGHT_STYLES} value={value.highlight_style || 'carousel'} onChange={(highlight_style) => set({ highlight_style })} />
      </div>
    </div>
  );
}