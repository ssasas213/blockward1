import React, { useState } from 'react';
import { Check } from 'lucide-react';
import Reveal from '@/components/home/Reveal';

// The Vault — a realistic credential portfolio, clearly marked as example
// data. Fictional organisations; nothing implies a real partnership.

const CREDENTIALS = [
  {
    title: 'National Robotics Championship — First Place',
    org: 'Meridian Institute of Technology',
    date: '12 Mar 2026',
    id: 'BW-K4T2M9QP',
    verified: true,
    signer: 'Dr. Amira Haddad, Head of Robotics',
    integrity: 'Fingerprint matches Polygon anchor',
  },
  {
    title: 'Advanced Lifeguard Certification',
    org: 'Northgate Aquatics',
    date: '28 Jan 2026',
    id: 'BW-P8W5R3TD',
    verified: true,
    signer: 'K. Ito, Chief Instructor',
    integrity: 'Fingerprint matches Polygon anchor',
  },
  {
    title: 'Grade 8 Violin — Distinction',
    org: 'City of Lakes Music Academy',
    date: '09 Dec 2025',
    id: 'BW-H6J9X2NA',
    verified: true,
    signer: 'M. Ferreira, Head of Strings',
    integrity: 'Fingerprint matches Polygon anchor',
  },
  {
    title: 'Young Enterprise Award',
    org: 'Halcyon Business Trust',
    date: '02 Oct 2026',
    id: null,
    verified: false,
    signer: null,
    integrity: null,
  },
];

export default function VaultSection() {
  const [selected, setSelected] = useState(0);
  const c = CREDENTIALS[selected];

  return (
    <section id="vault" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">The BlockWard Vault</p>
              <h2 className="font-display font-black text-4xl sm:text-6xl text-white leading-[1.05] tracking-tight">
                Every achievement, one place.
              </h2>
              <p className="mt-5 text-white/60 leading-relaxed">
                Credentials from every organisation that has verified you — collected in one
                permanent record you control, and shareable with a single link.
              </p>
            </div>
            <span className="self-start sm:self-end text-[10px] font-mono uppercase tracking-widest text-white/35 border border-white/10 rounded-full px-3 py-1 flex-shrink-0">
              Example data
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="px-5 sm:px-6 py-3.5 border-b border-white/10 flex items-center justify-between">
              <p className="text-[13px] font-medium text-white">Your Vault</p>
              <span className="font-mono text-[11px] text-white/35">{CREDENTIALS.length} credentials</span>
            </div>
            <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-6 py-2.5 text-[10px] uppercase tracking-widest text-white/35 border-b border-white/10">
              <p>Achievement</p>
              <p>Issued by</p>
              <p>Status</p>
              <p>Date</p>
            </div>
            {CREDENTIALS.map((row, i) => (
              <button
                key={row.title}
                onClick={() => setSelected(i)}
                className={`w-full text-left px-5 sm:px-6 py-4 border-b border-white/10 last:border-0 grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2 sm:gap-4 items-center transition-colors ${
                  selected === i ? 'bg-primary/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <p className="text-[13px] sm:text-sm text-white truncate">{row.title}</p>
                <p className="text-xs text-white/50 truncate">{row.org}</p>
                <p className="flex items-center gap-2 text-xs whitespace-nowrap">
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${row.verified ? 'bg-success' : 'bg-warning'}`} />
                  <span className={row.verified ? 'text-white/70' : 'text-white/50'}>
                    {row.verified ? 'Verified' : 'In verification'}
                  </span>
                </p>
                <p className="text-xs text-white/40 whitespace-nowrap">{row.date}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 grid sm:grid-cols-3 gap-5">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/35 mb-1.5">Verified by</p>
              <p className="text-sm text-white">{c.signer || 'Awaiting the issuer'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/35 mb-1.5">Integrity</p>
              <p className="text-sm text-white flex items-center gap-2">
                {c.integrity ? (
                  <>
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    {c.integrity}
                  </>
                ) : (
                  'Pending'
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/35 mb-1.5">Share link</p>
              <p className="text-sm font-mono text-white/70">{c.id ? `blockward.me/verify/${c.id}` : '—'}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}