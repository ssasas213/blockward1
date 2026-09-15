import React from 'react';
import { Plus, X, LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SocialLinksEditor from '@/components/profile/SocialLinksEditor';
import { CUSTOM_LINK_ICONS } from '@/lib/profileThemes';

// The Links tab — featured link, the 6 social icons, and up to 4 custom
// link rows (auto favicon or a chosen icon). Together: the link-in-bio hub.
export default function LinksSection({ value, set }) {
  const featured = value.featured_link;
  const customLinks = Array.isArray(value.custom_links) ? value.custom_links : [];

  const setLink = (i, patch) => set({ custom_links: customLinks.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const removeLink = (i) => set({ custom_links: customLinks.filter((_, idx) => idx !== i) });
  const addLink = () => set({ custom_links: [...customLinks, { label: '', url: '', icon: 'auto' }] });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Featured link</p>
        <p className="text-xs text-muted-foreground">
          One prominent button above your achievements — portfolio, CV, fundraiser or team page.
        </p>
        {featured?.url ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={featured.label || ''}
              onChange={(e) => set({ featured_link: { ...featured, label: e.target.value } })}
              placeholder="Label (e.g. My portfolio)"
              maxLength={60}
            />
            <Input
              value={featured.url || ''}
              onChange={(e) => set({ featured_link: { ...featured, url: e.target.value } })}
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
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Social links</p>
        <p className="text-xs text-muted-foreground">Up to 6 icon buttons under your bio. https:// is added automatically.</p>
        <SocialLinksEditor links={value.social_links} onChange={(social_links) => set({ social_links })} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Custom links</p>
        <p className="text-xs text-muted-foreground">
          Up to 4 labelled rows below your featured link — each with its favicon or a chosen icon.
        </p>
        <div className="space-y-2">
          {customLinks.map((l, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2">
              <Input
                value={l.label || ''}
                onChange={(e) => setLink(i, { label: e.target.value })}
                placeholder="Label"
                maxLength={40}
                className="sm:w-40 flex-shrink-0"
              />
              <Input
                value={l.url || ''}
                onChange={(e) => setLink(i, { url: e.target.value })}
                placeholder="https://…"
                className="flex-1"
              />
              <select
                value={l.icon || 'auto'}
                onChange={(e) => setLink(i, { icon: e.target.value })}
                className="h-9 rounded-md border border-border bg-secondary/50 px-2 text-sm text-foreground flex-shrink-0 sm:w-36"
                aria-label="Icon"
              >
                {CUSTOM_LINK_ICONS.map((ic) => (
                  <option key={ic.id} value={ic.id}>{ic.label}</option>
                ))}
              </select>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeLink(i)} className="text-destructive hover:bg-destructive/10 flex-shrink-0" aria-label="Remove link">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        {customLinks.length < 4 && (
          <Button type="button" variant="outline" size="sm" onClick={addLink}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add link ({customLinks.length}/4)
          </Button>
        )}
      </div>
    </div>
  );
}