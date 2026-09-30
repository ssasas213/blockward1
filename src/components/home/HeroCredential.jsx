import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BlockwardVerifiedMark } from '@/components/brand/BlockwardVerifiedMark';
import { IssuerMark, VerifierMark, IntegrityMark } from './StageMarks';

function Field({ label, value, sub }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-1 text-sm text-white/90">{value}</p>
      {sub && <p className="text-xs text-white/45">{sub}</p>}
    </div>
  );
}

function StatusLine({ Mark, label, status }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Mark className="h-4 w-4" />
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45">{label}</p>
      <p className="text-xs font-medium text-white/90">{status}</p>
    </div>
  );
}

/**
 * The hero credential — a premium dark digital credential (NOT a white
 * card). Deep blue-grey surface, hairline border, strong typographic
 * hierarchy, and the Blockward Verified mark as the trust anchor. It is the
 * visual culmination of the Issuer → Verifier → Integrity progression above.
 */
export default function HeroCredential() {
  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* barely-visible blue illumination that lifts the credential off the black */}
      <div
        aria-hidden="true"
        className="absolute -inset-4 -z-10"
        style={{ background: 'radial-gradient(ellipse 72% 60% at 50% 42%, rgba(37,99,235,0.12), transparent 70%)' }}
      />

      <div
        className="rounded-2xl border border-white/[0.08] bg-[#0F172A] p-7 sm:p-8"
        style={{ boxShadow: '0 30px 80px -24px rgba(0,0,0,0.65), 0 0 0 1px rgba(37,99,235,0.06)' }}
      >
        <div className="flex items-center justify-between">
          <BlockwardVerifiedMark size="sm" />
          <span className="font-mono text-[11px] text-white/30">Credential</span>
        </div>

        <div className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#93C5FD]/80">Professional Certificate</p>
          <h3 className="mt-1.5 text-xl font-semibold leading-snug tracking-tight text-white">in Product Design</h3>
        </div>

        <div className="mt-6 space-y-4">
          <Field label="Awarded to" value="Alex Morgan" />
          <Field label="Issued by" value="Example Design Institute" />
          <Field label="Authorised verifier" value="Jordan Lee" sub="Programme Director" />
        </div>

        <div className="mt-6 border-t border-white/[0.07] pt-5">
          <div className="grid grid-cols-3 gap-3">
            <StatusLine Mark={IssuerMark} label="Issuer" status="Verified" />
            <StatusLine Mark={VerifierMark} label="Signature" status="Confirmed" />
            <StatusLine Mark={IntegrityMark} label="Integrity" status="Confirmed" />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-5">
          <div className="leading-tight">
            <p className="font-mono text-xs text-white/70">BW-RBHWAXJZ</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/35">Polygon Amoy — Testnet</p>
          </div>
          <Link
            to="/verify/demo"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#93C5FD] transition-colors hover:text-white"
          >
            View Credential
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}