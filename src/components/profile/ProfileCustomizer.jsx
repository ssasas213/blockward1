import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, X, Palette, LayoutGrid, Type, LinkIcon, Star, Image as ImageIcon } from 'lucide-react';
import BannerUploader from '@/components/profile/BannerUploader';
import SocialLinksEditor from '@/components/profile/SocialLinksEditor';
import { THEMES, ACCENTS, FONTS, LAYOUTS } from '@/lib/profileThemes';

function Section({ icon: Icon, title, hint, children }) {
  return (
    <section className="space-y-3">
      <div>
        <Label className="flex items-center gap-1.5 text-sm">
          <Icon className="h-3.5 w-3.5 text-primary" /> {title}
        </Label>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

// The full profile customisation panel — every control is a designed preset,
// never raw styling. Controlled: value + onChange(partial).
export default function ProfileCustomizer({ value, onChange }) {
  const set = (patch) => onChange(patch);

  return (
    <div className="space-y-8">
      {/* Banner */}
      <Section icon={ImageIcon} title="Banner" hint="The cover at the top of your profile. Upload your own or pick a design.">
        <BannerUploader value={value.banner_url} onChange={(banner_url) => set({ banner_url })} />
      </Section>

      {/* Theme */}
      <Section icon={Palette} title="Theme" hint="A designed look for your whole profile — every one stays credible for employers and admissions officers.">
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
      </Section>

      {/* Accent */}
      <Section icon={Star} title="Accent colour" hint="One colour, from a fixed palette — used for buttons and highlights.">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => set({ accent_colour: null })}
            className={`h-8 w-8 rounded-full border-2 border-dashed border-border text-muted-foreground flex items-center justify-center text-[9px] font-bold ${!value.accent_colour ? 'ring-2 ring-primary/40' : ''}`}
            title="Theme default"
          >
            ✕
          </button>
          {ACCENTS.map((a) => {
            const selected = (value.accent_colour || '').toLowerCase() === a.hex.toLowerCase();
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
      </Section>

      {/* Font */}
      <Section icon={Type} title="Heading font" hint="Four curated pairings — your body text always stays clean Inter.">
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
      </Section>

      {/* Layout */}
      <Section icon={LayoutGrid} title="Achievement layout" hint="How your verified achievements are presented.">
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
      </Section>

      {/* Featured link */}
      <Section icon={LinkIcon} title="Featured link" hint="One prominent button above your achievements — portfolio, CV, fundraiser or team page. This is what makes the profile worth putting in a bio.">
        {value.featured_link?.url ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={value.featured_link.label || ''}
              onChange={(e) => set({ featured_link: { ...value.featured_link, label: e.target.value } })}
              placeholder="Label (e.g. My portfolio)"
              maxLength={60}
            />
            <Input
              value={value.featured_link.url || ''}
              onChange={(e) => set({ featured_link: { ...value.featured_link, url: e.target.value } })}
              placeholder="https://…"
              className="flex-1"
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => set({ featured_link: null })} className="text-destructive hover:bg-destructive/10 flex-shrink-0" aria-label="Remove featured link">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => set({ featured_link: { url: '', label: '' } })}>
            <LinkIcon className="h-3.5 w-3.5 mr-1.5" /> Add a featured link
          </Button>
        )}
      </Section>

      {/* Social links */}
      <Section icon={LinkIcon} title="Social links" hint="Up to 6 icon buttons under your bio. https:// is added automatically.">
        <SocialLinksEditor links={value.social_links} onChange={(social_links) => set({ social_links })} />
      </Section>
    </div>
  );
}