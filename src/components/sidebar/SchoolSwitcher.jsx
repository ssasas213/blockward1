import React from 'react';
import { BlockwardMark } from '@/components/brand/BlockwardLogo';

/** Sidebar brand mark. The legacy school switcher was removed — Blockward no
 *  longer requires a linked school. Organisation context for owners/verifiers
 *  lives on the organisation dashboard. */
export default function BrandMark() {
  return (
    <div className="h-14 flex items-center gap-2.5 px-4 border-b border-sidebar-border">
      <BlockwardMark className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm leading-tight">Blockward</p>
        <p className="text-xs text-tertiary truncate leading-tight">Verified achievements</p>
      </div>
    </div>
  );
}