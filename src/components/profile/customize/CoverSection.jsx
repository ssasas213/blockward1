import React from 'react';
import BannerUploader from '@/components/profile/BannerUploader';
import ChoiceGrid from '@/components/profile/customize/ChoiceGrid';
import { HERO_STYLES, SURFACE_PATTERNS, FORCED_SCHEMES } from '@/lib/profileThemes';

// The Cover tab — banner, hero composition, surface pattern and pinned scheme.
export default function CoverSection({ value, set }) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Banner</p>
        <p className="text-xs text-muted-foreground">The cover at the top of your profile. Upload your own or pick a design.</p>
        <BannerUploader value={value.banner_url} onChange={(banner_url) => set({ banner_url })} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Hero layout</p>
        <p className="text-xs text-muted-foreground">How the top of your page is composed.</p>
        <ChoiceGrid options={HERO_STYLES} value={value.hero_style || 'banner'} onChange={(hero_style) => set({ hero_style })} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Surface pattern</p>
        <p className="text-xs text-muted-foreground">A quiet texture behind your content — always very low opacity, never animated.</p>
        <ChoiceGrid options={SURFACE_PATTERNS} columns={2} value={value.surface_pattern || 'none'} onChange={(surface_pattern) => set({ surface_pattern })} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Appearance</p>
        <p className="text-xs text-muted-foreground">Pin how your page appears, or let it follow each viewer's own setting.</p>
        <ChoiceGrid options={FORCED_SCHEMES} value={value.forced_scheme || 'auto'} onChange={(forced_scheme) => set({ forced_scheme })} />
      </div>
    </div>
  );
}