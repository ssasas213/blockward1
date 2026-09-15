import React from 'react';
import { Button } from '@/components/ui/button';
import { Shuffle, RotateCcw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CoverSection from '@/components/profile/customize/CoverSection';
import StyleSection from '@/components/profile/customize/StyleSection';
import ContentSection from '@/components/profile/customize/ContentSection';
import LinksSection from '@/components/profile/customize/LinksSection';
import SectionsSection from '@/components/profile/customize/SectionsSection';
import { DEFAULT_PROFILE_CUSTOM, randomProfileCustom } from '@/lib/profileThemes';

// The full profile customisation panel — every control is a designed preset,
// never raw styling. Grouped into Cover / Style / Content / Links / Sections,
// with the live preview updating for every option. Controlled: value +
// onChange(patch) — every change PATCHES existing state, never replaces it.
export default function ProfileCustomizer({ value, onChange }) {
  const set = (patch) => onChange(patch);

  // Randomise and Reset touch visual fields only — links, tagline and the
  // other content are the student's own and stay exactly as they are.
  const randomise = () => set(randomProfileCustom());
  const resetToDefault = () => set({
    ...DEFAULT_PROFILE_CUSTOM,
    social_links: value.social_links,
    featured_link: value.featured_link,
    custom_links: value.custom_links,
    tagline: value.tagline,
    pronouns: value.pronouns,
    languages: value.languages,
    open_to: value.open_to,
  });

  return (
    <Tabs defaultValue="cover" className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="cover">Cover</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={randomise}>
            <Shuffle className="h-3.5 w-3.5 mr-1.5" /> Randomise
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset to default
          </Button>
        </div>
      </div>
      <TabsContent value="cover"><CoverSection value={value} set={set} /></TabsContent>
      <TabsContent value="style"><StyleSection value={value} set={set} /></TabsContent>
      <TabsContent value="content"><ContentSection value={value} set={set} /></TabsContent>
      <TabsContent value="links"><LinksSection value={value} set={set} /></TabsContent>
      <TabsContent value="sections"><SectionsSection value={value} set={set} /></TabsContent>
    </Tabs>
  );
}