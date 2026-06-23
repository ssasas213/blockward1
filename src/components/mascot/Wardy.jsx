import React, { useId } from 'react';
import { motion } from 'framer-motion';

// Wardy — the BlockWard mascot. A floating pink crystal diamond with a soft glow,
// friendly eyes, idle float animation, and subtle particle effects.
export default function Wardy({ size = 120, floating = true, withParticles = true, withEyes = true, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const gradId = `wardy-grad-${uid}`;
  const lightId = `wardy-light-${uid}`;
  const darkId = `wardy-dark-${uid}`;

  const particles = [
    { x: '6%', y: '22%', d: 0, s: 4 },
    { x: '86%', y: '16%', d: 0.6, s: 3 },
    { x: '90%', y: '68%', d: 1.2, s: 5 },
    { x: '4%', y: '74%', d: 0.3, s: 3 },
    { x: '50%', y: '2%', d: 0.9, s: 4 },
    { x: '52%', y: '90%', d: 1.5, s: 3 },
  ];

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* glow halo */}
      <div className="absolute inset-0 rounded-full bg-pink-400/30 blur-2xl scale-110" />

      {withParticles && particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-pink-300"
          style={{ width: p.s, height: p.s, left: p.x, top: p.y, boxShadow: '0 0 6px 1px rgba(244,114,182,0.8)' }}
          animate={{ y: [0, -10, 0], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, delay: p.d, ease: 'easeInOut' }}
        />
      ))}

      <motion.div
        animate={floating ? { y: [0, -8, 0], rotate: [-2, 2, -2] } : {}}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="relative w-full h-full"
      >
        <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-[0_4px_12px_rgba(236,72,153,0.4)]">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbcfe8" />
              <stop offset="50%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#db2777" />
            </linearGradient>
            <linearGradient id={lightId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fdf2f8" />
              <stop offset="100%" stopColor="#f9a8d4" />
            </linearGradient>
            <linearGradient id={darkId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#be185d" />
            </linearGradient>
          </defs>
          <polygon points="38,30 82,30 98,50 22,50" fill={`url(#${gradId})`} />
          <polygon points="38,30 60,50 22,50" fill={`url(#${lightId})`} opacity="0.9" />
          <polygon points="82,30 98,50 60,50" fill={`url(#${darkId})`} opacity="0.55" />
          <polygon points="22,50 60,98 60,50" fill={`url(#${darkId})`} opacity="0.7" />
          <polygon points="98,50 60,50 60,98" fill={`url(#${gradId})`} opacity="0.85" />
          <g stroke="#ffffff" strokeWidth="1" opacity="0.5" fill="none" strokeLinejoin="round">
            <polygon points="38,30 82,30 98,50 22,50" />
            <line x1="38" y1="30" x2="60" y2="50" />
            <line x1="82" y1="30" x2="60" y2="50" />
            <line x1="22" y1="50" x2="60" y2="98" />
            <line x1="98" y1="50" x2="60" y2="98" />
            <line x1="60" y1="50" x2="60" y2="98" />
          </g>
          <polygon points="42,32 52,32 44,48 34,48" fill="#ffffff" opacity="0.35" />
        </svg>

        {withEyes && (
          <div className="absolute left-0 right-0 flex items-center justify-center gap-3" style={{ top: '44%' }}>
            <Eye />
            <Eye />
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Eye() {
  return (
    <div className="relative" style={{ width: 11, height: 14 }}>
      <div className="absolute inset-0 bg-white rounded-full" />
      <motion.div
        className="absolute rounded-full bg-slate-800"
        style={{ width: 6, height: 6, top: 4, left: 2.5 }}
        animate={{ y: [0, 1, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute rounded-full bg-white" style={{ width: 2, height: 2, top: 4, left: 4 }} />
    </div>
  );
}