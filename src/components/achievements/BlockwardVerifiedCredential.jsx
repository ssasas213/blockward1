import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { BlockwardMark } from '@/components/brand/BlockwardLogo';
import { formatDate, formatDateTime } from '@/lib/achievementStatus';

function Row({ label, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-4 py-2 border-b border-border/60 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-tertiary">{label}</dt>
      <dd className="text-sm text-foreground font-medium sm:text-right">{children}</dd>
    </div>
  );
}

/**
 * Premium Blockward Verified credential — the fully-verified presentation.
 * Feels like a professional digital document: Blockward branding, verified
 * header, achievement + holder + issuer, authorised verifiers, integrity.
 * Used inside the achievement detail drawer and eligible for the public page.
 */
export default function BlockwardVerifiedCredential({ item }) {
  const a = item || {};
  const c = a.credential || {};
  const bc = c.blockchain || {};
  const verifiers = c.verifiers || [];
  const holderName = a.holder_name || c.holder_display_name || '—';

  return (
    <div className="surface-card verified-glow rounded-2xl overflow-hidden">
      {/* Header band */}
      <div className="bg-brand-gradient px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center">
            <BlockwardMark className="h-5 w-5" />
          </div>
          <span className="font-semibold text-white tracking-tight">Blockward</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1">
          <Check className="h-3.5 w-3.5 text-white" />
          <span className="text-xs font-semibold text-white uppercase tracking-wide">Blockward Verified</span>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <p className="text-xs uppercase tracking-wider text-tertiary mb-1">Achievement</p>
        <h2 className="text-xl font-bold text-foreground leading-tight mb-4">{a.title}</h2>

        <dl>
          <Row label="Awarded to">{holderName}</Row>
          <Row label="Issued by">{c.issuer_org || a.issuer_org}</Row>
          <Row label="Achievement date">{formatDate(a.date_achieved)}</Row>
          {c.bw_id && <Row label="Credential ID">{c.bw_id}</Row>}
          {c.verified_at && <Row label="Verified on">{formatDateTime(c.verified_at)}</Row>}
        </dl>

        {/* Authorised verifiers */}
        {verifiers.length > 0 && (
          <div className="mt-5">
            <p className="text-xs uppercase tracking-wider text-tertiary mb-2">Authorised verifier{verifiers.length > 1 ? 's' : ''}</p>
            <div className="space-y-1.5">
              {verifiers.map((v, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="h-5 w-5 rounded-full bg-success/15 border border-success/30 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-success" />
                  </span>
                  <span className="text-foreground font-medium">{v.name}</span>
                  {v.title && <span className="text-tertiary">· {v.title}</span>}
                  {v.signed_at && <span className="text-tertiary text-xs ml-auto">{formatDate(v.signed_at)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Integrity line */}
        <div className="mt-5 flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5">
          <Check className="h-4 w-4 text-success flex-shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-success">Integrity confirmed</p>
            <p className="text-tertiary">Anchored on Polygon Amoy · commitment {c.credential_hash ? c.credential_hash.slice(0, 12) + '…' : '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}