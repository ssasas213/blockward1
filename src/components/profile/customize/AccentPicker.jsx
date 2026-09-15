import React from 'react';
import { ACCENTS } from '@/lib/profileThemes';

// Accent colour from the fixed 12-colour palette, plus the optional
// gradient end colour — a second palette colour that turns the accent into
// a two-stop gradient. Both stops drive a contrast-safe foreground.
export default function AccentPicker({ value, set }) {
  const accent = value.accent_colour || null;
  const grad = value.accent_gradient || null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Accent colour</p>
        <p className="text-xs text-muted-foreground">One colour, from a fixed palette — used for buttons and highlights.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => set({ accent_colour: null, accent_gradient: null })}
            className={`h-8 w-8 rounded-full border-2 border-dashed border-border text-muted-foreground flex items-center justify-center text-[9px] font-bold ${!accent ? 'ring-2 ring-primary/40' : ''}`}
            title="Theme default"
          >
            ✕
          </button>
          {ACCENTS.map((a) => {
            const selected = (accent || '').toLowerCase() === a.hex.toLowerCase();
            return (
              <button
                key={a.hex}
                type="button"
                title={a.name}
                aria-label={a.name}
                onClick={() => set({ accent_colour: a.hex })}
                className={`h-8 w-8 rounded-full border border-border transition-transform hover:scale-110 ${selected ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background' : ''}`}
                style={{ background: a.hex }}
              />
            );
          })}
        </div>
      </div>

      {accent && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Gradient end colour</p>
          <p className="text-xs text-muted-foreground">
            Optional second colour — your accent becomes a two-stop gradient. Text on it always passes WCAG AA automatically.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => set({ accent_gradient: null })}
              className={`h-8 w-8 rounded-full border-2 border-dashed border-border text-muted-foreground flex items-center justify-center text-[9px] font-bold ${!grad ? 'ring-2 ring-primary/40' : ''}`}
              title="Flat (no gradient)"
            >
              ✕
            </button>
            {ACCENTS.filter((a) => a.hex.toLowerCase() !== accent.toLowerCase()).map((a) => {
              const selected = (grad || '').toLowerCase() === a.hex.toLowerCase();
              return (
                <button
                  key={a.hex}
                  type="button"
                  title={a.name}
                  aria-label={a.name}
                  onClick={() => set({ accent_gradient: a.hex })}
                  className={`h-8 w-8 rounded-full border border-border transition-transform hover:scale-110 ${selected ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background' : ''}`}
                  style={{ background: a.hex }}
                />
              );
            })}
          </div>
          {grad && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-border p-2">
              <span className="h-6 w-24 rounded-md" style={{ background: `linear-gradient(135deg, ${accent}, ${grad})` }} />
              <span className="text-xs text-muted-foreground">Gradient preview</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}