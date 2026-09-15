import React from 'react';
import ThemePicker from '@/components/profile/customize/ThemePicker';
import AccentPicker from '@/components/profile/customize/AccentPicker';
import FontPicker from '@/components/profile/customize/FontPicker';
import LayoutPicker from '@/components/profile/customize/LayoutPicker';
import ChoiceGrid from '@/components/profile/customize/ChoiceGrid';
import { AVATAR_FRAMES, CARD_STYLES, CORNER_STYLES, CARD_DENSITY } from '@/lib/profileThemes';

// The Style tab — every visual preset on one page, all bounded choices.
export default function StyleSection({ value, set }) {
  return (
    <div className="space-y-8">
      <ThemePicker value={value} set={set} />
      <AccentPicker value={value} set={set} />
      <FontPicker value={value} set={set} />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Avatar frame</p>
        <ChoiceGrid options={AVATAR_FRAMES} value={value.avatar_frame || 'none'} onChange={(avatar_frame) => set({ avatar_frame })} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Card style</p>
        <ChoiceGrid options={CARD_STYLES} value={value.card_style || 'elevated'} onChange={(card_style) => set({ card_style })} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Corners</p>
        <ChoiceGrid options={CORNER_STYLES} value={value.corner_style || 'rounded'} onChange={(corner_style) => set({ corner_style })} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Density</p>
        <ChoiceGrid options={CARD_DENSITY} columns={2} value={value.card_density || 'comfortable'} onChange={(card_density) => set({ card_density })} />
      </div>
      <LayoutPicker value={value} set={set} />
    </div>
  );
}