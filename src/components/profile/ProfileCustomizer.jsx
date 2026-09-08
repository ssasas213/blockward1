import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import BannerUploader from '@/components/profile/BannerUploader';
import SocialLinksEditor from '@/components/profile/SocialLinksEditor';
import { THEMES, ACCENT_PALETTE, FONT_OPTIONS, LAYOUT_OPTIONS, themeVars } from '@/lib/profileThemes';

/**
 * ProfileCustomizer — bounded visual customisation for the public profile.
 * Everything is a designed preset: 10 themes, 12 accent colours, 12
 * built-in banners, 4 font pairings, 3 layouts. Never raw styling.
 * Controlled via onChange(partial).
 */
export default function ProfileCustomizer({
  themeId, accentColour, profileLayout, displayFont,
  bannerUrl, socialLinks, featuredLink, onChange,
}) {
  const [featuredUrl, setFeaturedUrl] = useState(featuredLink?.url || '');
  const [featuredLabel, setFeaturedLabel] = useState(featuredLink?.label || '');

  const setFeatured = () => {
    if (!featuredUrl.trim()) { onChange({ featured_link: null }); return; }
    onChange({
      featured_link: {
        url: featuredUrl.trim(),
        label: featuredLabel.trim().slice(0, 60) || null,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="space-y-2">
        <Label>Cover banner</Label>
        <BannerUploader value={bannerUrl} onChange={(v) => onChange({ banner_url: v })} />
      </div>

      {/* Theme */}
      <div className="space-y-2">
        <Label>Theme</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange({ theme_id: t.id })}
              title={t.desc}
              className={cn(
                'rounded-lg border overflow-hidden text-left transition-all hover:-translate-y-0.5',
                themeId === t.id ? 'border-primary ring-2 ring-primary/40' : 'border-border'
              )}
            >
              <div className="h-9 w-full" style={{ background: t.banner }} />
              <div className="px-2 py-1.5 bg-secondary/40">
                <p className="text-xs font-semibold text-foreground truncate">{t.label}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {THEMES.find((t) => t.id === themeId)?.desc}
        </p>
      </div>

      {/* Accent */}
      <div className="space-y-2">
        <Label>Accent colour</Label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ accent_colour: null })}
            className={cn(
              'h-8 px-3 rounded-lg border text-xs font-medium transition-all',
              !accentColour ? 'border-primary ring-2 ring-primary/40 text-primary' : 'border-border text-muted-foreground hover:bg-hover'
            )}
          >
            Theme default
          </button>
          {ACCENT_PALETTE.map((a) => (
            <button
              key={a.hex}
              type="button"
              title={a.label}
              onClick={() => onChange({ accent_colour: a.hex })}
              className={cn(
                'h-8 w-8 rounded-lg border-2 transition-all hover:-translate-y-0.5',
                accentColour === a.hex ? 'border-foreground scale-110' : 'border-transparent'
              )}
              style={{ background: a.hex }}
            >
              <span className="sr-only">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Layout */}
      <div className="space-y-2">
        <Label>Achievement layout</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {LAYOUT_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange({ profile_layout: o.id })}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                profileLayout === o.id ? 'border-primary/50 bg-primary/10' : 'border-border bg-background hover:bg-hover'
              )}
            >
              <p className={cn('text-sm font-medium', profileLayout === o.id ? 'text-primary' : 'text-foreground')}>{o.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Font */}
      <div className="space-y-2">
        <Label>Heading font</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange({ display_font: f.id })}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                displayFont === f.id ? 'border-primary/50 bg-primary/10' : 'border-border bg-background hover:bg-hover'
              )}
            >
              <p className="text-base font-semibold text-foreground" style={{ fontFamily: f.heading }}>{f.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Social links */}
      <div className="space-y-2">
        <Label>Social links</Label>
        <SocialLinksEditor value={socialLinks} onChange={(v) => onChange({ social_links: v })} />
      </div>

      {/* Featured link */}
      <div className="space-y-2">
        <Label>Featured link — one prominent button on your profile</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            className="flex-1 h-9"
            placeholder="Your portfolio, CV, fundraiser or team page (https://…)"
            value={featuredUrl}
            onChange={(e) => setFeaturedUrl(e.target.value)}
            onBlur={setFeatured}
          />
          <Input
            className="sm:w-[170px] h-9"
            placeholder="Button label"
            value={featuredLabel}
            onChange={(e) => setFeaturedLabel(e.target.value)}
            onBlur={setFeatured}
          />
        </div>
        {featuredLink?.url && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground truncate flex-1">“{featuredLink.label || 'View my work'}” → {featuredLink.url}</span>
            <Button
              type="button" size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive h-7"
              onClick={() => { setFeaturedUrl(''); setFeaturedLabel(''); onChange({ featured_link: null }); }}
            >
              Remove
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}