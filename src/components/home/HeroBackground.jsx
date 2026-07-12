import React, { useMemo } from 'react';

const FLOATING_OBJECTS = [
  { type: 'badge',       pos: { top: '15%', left: '5%' },   size: 64, delay: '0s',   dur: '12s', anim: 'hero-float',       show: 'hidden lg:block' },
  { type: 'certificate', pos: { top: '22%', right: '5%' },  size: 72, delay: '3s',   dur: '14s', anim: 'hero-float-alt',   show: 'hidden lg:block' },
  { type: 'shield',      pos: { bottom: '18%', left: '8%' }, size: 56, delay: '5s',   dur: '11s', anim: 'hero-float',       show: 'hidden xl:block' },
  { type: 'token',       pos: { bottom: '22%', right: '7%' }, size: 60, delay: '1.5s', dur: '13s', anim: 'hero-float-alt',   show: 'hidden xl:block' },
];

function ObjectSvg({ type }) {
  const purple = 'hsl(263 70% 62%)';
  const pink = 'hsl(329 73% 62%)';
  switch (type) {
    case 'badge':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full">
          <polygon points="40,6 70,23 70,57 40,74 10,57 10,23" fill="none" stroke={purple} strokeWidth="1.5" />
          <path d="M27 40 L35 48 L53 30" fill="none" stroke={pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'certificate':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full">
          <rect x="8" y="10" width="64" height="60" rx="6" fill="none" stroke={purple} strokeWidth="1.5" />
          <line x1="20" y1="26" x2="60" y2="26" stroke={purple} strokeWidth="1" opacity="0.5" />
          <line x1="20" y1="36" x2="52" y2="36" stroke={purple} strokeWidth="1" opacity="0.5" />
          <circle cx="40" cy="52" r="7" fill="none" stroke={pink} strokeWidth="1.5" />
          <path d="M36 52 L39 55 L44 49" fill="none" stroke={pink} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full">
          <path d="M40 8 L64 18 L64 42 C64 56 53 67 40 72 C27 67 16 56 16 42 L16 18 Z" fill="none" stroke={purple} strokeWidth="1.5" />
          <path d="M28 40 L36 48 L52 32" fill="none" stroke={pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'token':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full">
          <polygon points="40,8 66,24 66,56 40,72 14,56 14,24" fill="none" stroke={purple} strokeWidth="1.5" />
          <polygon points="40,24 54,32 54,48 40,56 26,48 26,32" fill="none" stroke={pink} strokeWidth="1" opacity="0.5" />
          <circle cx="40" cy="40" r="3.5" fill={purple} opacity="0.3" />
        </svg>
      );
    default:
      return null;
  }
}

function FloatingObject({ type, pos, size, delay, dur, anim, show }) {
  return (
    <div
      className={`absolute ${show}`}
      style={{
        ...pos,
        width: size,
        height: size,
        background: 'hsl(263 40% 15% / 0.2)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid hsl(263 70% 52% / 0.15)',
        borderRadius: '16px',
        boxShadow: '0 0 24px hsl(263 70% 52% / 0.08)',
        animation: `${anim} ${dur} ease-in-out ${delay} infinite`,
      }}
    >
      <ObjectSvg type={type} />
    </div>
  );
}

export default function HeroBackground() {
  const particles = useMemo(
    () =>
      Array.from({ length: 20 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: `${2 + Math.random() * 3}px`,
        delay: `${Math.random() * 12}s`,
        dur: `${10 + Math.random() * 8}s`,
        opacity: 0.1 + Math.random() * 0.15,
      })),
    []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Layer 1+2: Base gradient + ambient lighting */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse 55% 40% at 50% 28%, hsl(263 70% 52% / 0.12), transparent 60%),
          radial-gradient(ellipse 35% 45% at 85% 70%, hsl(329 73% 56% / 0.07), transparent 60%),
          radial-gradient(ellipse 45% 25% at 50% 68%, hsl(263 70% 52% / 0.06), transparent 60%),
          radial-gradient(ellipse 80% 60% at 50% 35%, #1B102E 0%, #0B0B12 70%)
        `,
      }} />

      {/* Pulsing glow behind headline */}
      <div
        className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full"
        style={{
          background: 'radial-gradient(ellipse, hsl(263 70% 52% / 0.12), transparent 70%)',
          animation: 'hero-glow-pulse 10s ease-in-out infinite',
        }}
      />

      {/* Layer 3: Curved lines */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="heroLinePurple" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(263 70% 52%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(263 70% 52%)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="hsl(263 70% 52%)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="heroLinePink" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(329 73% 56%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(329 73% 56%)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="hsl(329 73% 56%)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M -100 300 Q 400 200, 720 280 T 1540 220" fill="none" stroke="url(#heroLinePurple)" strokeWidth="1.5" />
        <path d="M -100 500 Q 360 420, 720 460 T 1540 400" fill="none" stroke="url(#heroLinePurple)" strokeWidth="1" />
        <path d="M -100 680 Q 400 600, 720 640 T 1540 580" fill="none" stroke="url(#heroLinePink)" strokeWidth="1" />
        <path d="M -100 180 Q 500 100, 720 160 T 1540 100" fill="none" stroke="url(#heroLinePink)" strokeWidth="0.8" />
      </svg>

      {/* Layer 4: Perspective grid floor */}
      <div className="absolute bottom-0 left-0 right-0 h-[35%] overflow-hidden">
        {/* Horizon glow line */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-px"
          style={{ background: 'linear-gradient(to right, transparent, hsl(263 70% 52% / 0.2), transparent)' }}
        />
        {/* Grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(263 70% 52% / 0.07) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(263 70% 52% / 0.07) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            transform: 'perspective(400px) rotateX(65deg)',
            transformOrigin: 'bottom center',
            maskImage: 'linear-gradient(to top, black 0%, transparent 90%)',
            WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 90%)',
          }}
        />
        {/* Purple reflection tint */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, hsl(263 70% 52% / 0.03), transparent 60%)',
          }}
        />
      </div>

      {/* Layer 5: Floating verification objects */}
      {FLOATING_OBJECTS.map((obj, i) => (
        <FloatingObject key={i} {...obj} />
      ))}

      {/* Layer 6: Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-primary"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            filter: 'blur(2px)',
            animation: `hero-particle-drift ${p.dur} ease-in-out ${p.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}