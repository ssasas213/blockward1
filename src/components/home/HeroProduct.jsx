import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Check, PenTool, ShieldCheck, Fingerprint } from 'lucide-react';

const NODES = [
  { icon: Building2, label: 'Issuer', status: 'Verified' },
  { icon: PenTool, label: 'Verifier', status: 'Signed' },
  { icon: Fingerprint, label: 'Polygon', status: 'Secured' },
];

/**
 * Hero product visual — a floating credential card with the three
 * verification layers connected above it. Pure CSS, no images.
 */
export default function HeroProduct() {
  return (
    <div className="relative max-w-3xl mx-auto mt-16 sm:mt-20 px-2">
      {/* Connecting line between the three nodes */}
      <div
        className="hidden md:block absolute top-7 left-[18%] right-[18%] h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(258 90% 66% / 0.4), hsl(330 81% 60% / 0.4), transparent)' }}
      />

      <div className="grid grid-cols-3 gap-3 md:gap-6">
        {NODES.map((n) => (
          <div key={n.label} className="relative z-10 surface-card rounded-xl px-3 py-4 flex flex-col items-center gap-1.5">
            <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center">
              <n.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/85">{n.label}</p>
            <span className="inline-flex items-center gap-1 text-[11px] text-brand-violet">
              <Check className="h-3 w-3" /> {n.status}
            </span>
          </div>
        ))}
      </div>

      {/* Credential card */}
      <div className="relative z-10 mt-8 max-w-md mx-auto surface-card verified-glow rounded-2xl p-6 animate-fade-in">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          <ShieldCheck className="h-3.5 w-3.5" />
          Blockward Verified
        </div>

        <h3 className="mt-4 text-lg font-semibold text-white leading-snug">
          AWS Certified Cloud Practitioner
        </h3>
        <p className="text-sm text-white/60 mt-0.5">Mazen Example</p>

        <div className="mt-5 grid grid-cols-2 gap-4 text-left">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Issued by</p>
            <p className="text-sm text-white/85 mt-1">Amazon Web Services</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Verified by</p>
            <p className="text-sm text-white/85 mt-1">John Smith</p>
            <p className="text-xs text-white/50">Certification Manager</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] text-success">
            <Check className="h-3 w-3" /> Issuer Verified
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-brand-violet">
            <Check className="h-3 w-3" /> Integrity Confirmed
          </span>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-white/50">BW-RBHWAXJZ</span>
          <Link to="/verify/demo" className="text-sm text-brand-violet hover:text-white transition-colors inline-flex items-center gap-1">
            View Credential <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}