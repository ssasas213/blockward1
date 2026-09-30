import React from 'react';
import { Shield } from 'lucide-react';

/**
 * BrandMark — the Blockward wordmark shown at the top of the sidebar.
 *
 * The legacy "school switcher" (No school linked / Join a School / school
 * codes / school selector) has been removed: Blockward no longer requires a
 * linked school. Organisation context for owners and verifiers lives on the
 * organisation dashboard; holders need no organisation to use the product.
 */
export default function BrandMark() {
  return (
    <div className="h-14 flex items-center gap-2.5 px-4 border-b border-sidebar-border">
      <Shield className="h-5 w-5 text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm leading-tight">BlockWard</p>
        <p className="text-xs text-tertiary truncate leading-tight">Verified achievements</p>
      </div>
    </div>
  );
}