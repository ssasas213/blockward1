import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
import { SOCIAL_PLATFORMS } from '@/lib/profileThemes';

// Editor for the link-in-bio: up to 6 whitelisted-platform links with an
// optional label each. URLs are forced to https server-side on save.
export default function SocialLinksEditor({ links, onChange }) {
  const list = Array.isArray(links) ? links : [];
  const update = (i, patch) => onChange(list.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => onChange([...list, { platform: 'instagram', url: '', label: '' }]);

  return (
    <div className="space-y-2">
      {list.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No links yet. Add up to 6 — Instagram, TikTok, LinkedIn, GitHub, YouTube, X, Discord, Behance, Dribbble, Strava, Chess.com or your own website.
        </p>
      )}
      {list.map((l, i) => (
        <div key={i} className="flex flex-col sm:flex-row gap-2">
          <select
            value={l.platform}
            onChange={(e) => update(i, { platform: e.target.value })}
            className="h-9 rounded-md border border-border bg-secondary/50 px-2 text-sm text-foreground flex-shrink-0 sm:w-36"
            aria-label="Platform"
          >
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <Input
            value={l.url || ''}
            onChange={(e) => update(i, { url: e.target.value })}
            placeholder="yourname or https://…"
            className="flex-1"
          />
          <Input
            value={l.label || ''}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="Label"
            maxLength={40}
            className="flex-1 sm:w-32"
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} className="text-destructive hover:bg-destructive/10 flex-shrink-0" aria-label="Remove link">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {list.length < 6 && (
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add link ({list.length}/6)
        </Button>
      )}
      <p className="text-xs text-muted-foreground">https:// is added automatically — links open safely in a new tab.</p>
    </div>
  );
}