import React from 'react';
import { Input } from '@/components/ui/input';
import { LANGUAGE_OPTIONS, OPEN_TO_OPTIONS } from '@/lib/profileThemes';
import { cn } from '@/lib/utils';

function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
        selected ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-hover',
      )}
    >
      {children}
    </button>
  );
}

// The Content tab — tagline, pronouns, languages and the "open to" chips.
// No location field here, ever: these are minors' public pages.
export default function ContentSection({ value, set }) {
  const tagline = value.tagline || '';
  const pronouns = value.pronouns || '';
  const languages = value.languages || [];
  const openTo = value.open_to || [];

  const toggleLanguage = (l) => set({
    languages: languages.includes(l)
      ? languages.filter((x) => x !== l)
      : languages.length >= 8 ? languages : [...languages, l],
  });
  const toggleOpenTo = (id) => set({
    open_to: openTo.includes(id) ? openTo.filter((x) => x !== id) : [...openTo, id],
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Tagline</p>
        <p className="text-xs text-muted-foreground">
          One line under your name — separate from your bio. e.g. “Year 12 · 400m · Grade 8 violin”.
        </p>
        <Input
          value={tagline}
          maxLength={60}
          onChange={(e) => set({ tagline: e.target.value })}
          placeholder="Year 12 · 400m · Grade 8 violin"
        />
        <p className="text-xs text-muted-foreground text-right">{tagline.length}/60</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Pronouns</p>
        <p className="text-xs text-muted-foreground">Optional — shown next to your handle.</p>
        <Input
          value={pronouns}
          maxLength={20}
          onChange={(e) => set({ pronouns: e.target.value })}
          placeholder="she/her"
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Languages</p>
        <p className="text-xs text-muted-foreground">Up to 8 — shown as chips on your profile.</p>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGE_OPTIONS.map((l) => (
            <Chip key={l} selected={languages.includes(l)} onClick={() => toggleLanguage(l)}>{l}</Chip>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Open to</p>
        <p className="text-xs text-muted-foreground">
          Shown as a banner on your profile — and matching opportunities surface first for you in Explore.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {OPEN_TO_OPTIONS.map((o) => (
            <Chip key={o.id} selected={openTo.includes(o.id)} onClick={() => toggleOpenTo(o.id)}>{o.label}</Chip>
          ))}
        </div>
      </div>
    </div>
  );
}