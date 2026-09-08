import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { createPageUrl } from '@/utils';

/**
 * TrustStrip — the verifiability differentiator, shown under the
 * achievements. A visitor who doesn't know BlockWard should immediately see
 * that this is not just another link-in-bio page: every credential is signed
 * by the issuing organisation and independently checkable.
 */
export default function TrustStrip({ className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl border border-success/25 bg-success/5 px-4 py-3 ${className}`}>
      <ShieldCheck className="h-5 w-5 text-success flex-shrink-0" />
      <p className="flex-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        Every credential on this profile was <span className="font-semibold text-foreground">signed by the issuing organisation</span> and
        can be <span className="font-semibold text-foreground">independently verified by anyone</span> — no account needed.
      </p>
      <a href={createPageUrl('Verify')} className="text-xs sm:text-sm font-medium text-primary hover:underline flex-shrink-0">
        How verification works →
      </a>
    </div>
  );
}