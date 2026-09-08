import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { SOCIAL_PLATFORMS } from '@/lib/profileThemes';

/**
 * SocialLinksEditor — the link-in-bio editor: up to 6 links from the
 * supported platform list. https:// is forced server-side on save.
 */
export default function SocialLinksEditor({ value = [], onChange }) {
  const update = (i, patch) => {
    const next = value.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    onChange(next);
  };
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => {
    if (value.length >= 6) return;
    onChange([...value, { platform: 'instagram', url: '', label: '' }]);
  };

  return (
    <div className="space-y-2">
      {value.map((l, i) => {
        const platform = SOCIAL_PLATFORMS.find((p) => p.id === l.platform);
        return (
          <div key={i} className="flex flex-col sm:flex-row gap-2">
            <Select value={l.platform} onValueChange={(v) => update(i, { platform: v })}>
              <SelectTrigger className="sm:w-[150px] flex-shrink-0 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_PLATFORMS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="flex-1 h-9"
              placeholder={`${platform?.label || 'Link'} URL — https:// added automatically`}
              value={l.url || ''}
              onChange={(e) => update(i, { url: e.target.value.slice(0, 200) })}
            />
            <Input
              className="sm:w-[130px] h-9"
              placeholder="Label (optional)"
              value={l.label || ''}
              onChange={(e) => update(i, { label: e.target.value.slice(0, 40) })}
            />
            <Button type="button" size="icon" variant="ghost" className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
      {value.length < 6 && (
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4 mr-1.5" /> Add link ({value.length}/6)
        </Button>
      )}
      <p className="text-xs text-muted-foreground">Links open safely in a new tab and are marked nofollow for search engines.</p>
    </div>
  );
}