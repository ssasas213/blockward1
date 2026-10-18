import React from 'react';
import { motion } from 'framer-motion';
import { BlockwardMark } from '@/components/brand/BlockwardLogo';

// Illustrative, clearly-marked example credential — fictional organisation,
// fictional person. Never implies a real partnership.
const FINGERPRINT_BARS = [6, 10, 14, 8, 16, 11, 7, 13, 17, 9, 5, 12, 15, 8, 10, 6, 14, 9, 12, 7, 11, 16, 8, 5];

export default function CredentialCard() {
  return (
    <div className="relative w-full max-w-[400px]">
      <div
        className="absolute -inset-12 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 42%, hsl(217 84% 53% / 0.14), transparent 70%)' }}
      />
      <motion.div
        initial={{ opacity: 0, y: 28, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: -2 }}
        transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl border border-white/10 bg-[#10182a] p-7 shadow-[0_30px_80px_rgb(0_0_0/0.5),0_0_60px_hsl(217_84%_53%/0.08)]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <BlockwardMark className="h-6 w-6 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">Meridian Institute of Technology</p>
              <p className="text-[10px] uppercase tracking-widest text-white/40">Verified issuer</p>
            </div>
          </div>
          <span className="h-2 w-2 rounded-full bg-success flex-shrink-0" aria-label="Active" />
        </div>

        <div className="my-5 h-px bg-white/10" />

        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Achievement</p>
        <h3 className="font-display text-xl text-white leading-snug">
          National Robotics Championship — First Place
        </h3>
        <p className="mt-3 text-xs text-white/55">Verified by Dr. Amira Haddad · Head of Robotics</p>

        <div className="mt-5 flex items-center justify-between">
          <span className="font-mono text-[11px] text-white/45 tracking-wider">BW-K4T2M9QP</span>
          <span className="text-[10px] text-white/40">Anchored on Polygon</span>
        </div>

        {/* Content fingerprint — visual, not a real hash */}
        <div className="mt-4 flex items-end gap-[3px] h-4" aria-hidden="true">
          {FINGERPRINT_BARS.map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm bg-primary/50"
              style={{ height: `${h}px`, opacity: 0.35 + (h / 17) * 0.5 }}
            />
          ))}
        </div>
      </motion.div>
      <p className="mt-4 text-center text-[11px] text-white/35">Example credential — illustrative data</p>
    </div>
  );
}