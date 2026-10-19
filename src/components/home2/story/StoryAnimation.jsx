import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SceneTrophy from './SceneTrophy';
import SceneNetwork from './SceneNetwork';
import SceneVault from './SceneVault';
import SceneVerify, { VerificationCard } from './SceneVerify';

// StoryAnimation — "From achievement to opportunity". One continuous
// ~12s cinematic journey in four beats: trophy → blockchain anchor →
// BlockWard Vault → employer verification. Pure CSS keyframes on a single
// timeline (remounted on replay), paused off-screen, static fallback under
// prefers-reduced-motion. Illustration only — never implies a live check.
const BEATS = [
  { text: 'Every achievement has a story.', delay: 0.4, out: 2.9 },
  { text: 'A record you can trust.', delay: 3.5, out: 6.0 },
  { text: 'Every achievement. One place.', delay: 6.9, out: 8.9 },
  { text: 'Proof that opens doors.', delay: 9.9, out: 11.2 },
];

export default function StoryAnimation() {
  const [runId, setRunId] = useState(0);
  const [started, setStarted] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [reduced, setReduced] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setOnScreen(entry.isIntersecting);
        if (entry.isIntersecting) setStarted(true);
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (reduced) return <StaticStory />;

  return (
    <section ref={sectionRef} id="story" className="relative px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <style>{STORY_CSS}</style>
      <div className="mx-auto mb-10 max-w-3xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">How BlockWard works</p>
        <h2 className="font-display text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
          From achievement to opportunity
        </h2>
      </div>

      {started && (
        <div key={runId}>
          <div className="relative mx-auto max-w-5xl">
            <div
              className={`relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_60%_50%_at_50%_35%,rgb(37_99_235/0.10),transparent_70%),linear-gradient(180deg,#0B1120,#080C16)] sm:aspect-[16/10] ${!onScreen ? 'film-paused' : ''}`}
            >
              <Stage />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-white/35">Illustration of the BlockWard workflow — example data, not a live credential.</p>
              <button
                onClick={() => setRunId((r) => r + 1)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:border-white/25 hover:text-white"
                aria-label="Replay animation"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Replay
              </button>
            </div>
          </div>

          {/* Final call to action — the story lands here */}
          <div className="mt-12 text-center" style={{ animation: 'sw-in 0.6s ease both', animationDelay: '11.4s' }}>
            <h3 className="font-display text-2xl font-black text-white sm:text-3xl md:text-4xl">
              Your achievements deserve to go further.
            </h3>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="h-12 px-8 text-base" onClick={() => (window.location.href = '/Signup')}>
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 bg-transparent px-8 text-base text-white border-white/20 hover:bg-white/5"
                onClick={() => document.getElementById('own')?.scrollIntoView({ behavior: 'smooth' })}
              >
                See How It Works
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Stage() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {/* Story beats — a fixed caption slot keeps the journey continuous */}
      <div className="absolute inset-x-0 top-6 z-10 sm:top-10">
        {BEATS.map((b) => (
          <div key={b.text} className="absolute inset-x-0 top-0 px-6 text-center">
            <p
              className="font-display text-xl text-white/95 [text-shadow:0_1px_18px_rgb(0_0_0/0.6)] sm:text-2xl md:text-[1.7rem]"
              style={{ animation: 'sw-in 0.5s ease both, sw-out 0.45s ease both', animationDelay: `${b.delay}s, ${b.out}s` }}
            >
              {b.text}
            </p>
          </div>
        ))}
        {/* Closing beat */}
        <div className="absolute inset-x-0 top-0 px-6 text-center">
          <p
            className="font-display text-xl text-white/95 [text-shadow:0_1px_18px_rgb(0_0_0/0.6)] sm:text-2xl md:text-[1.7rem]"
            style={{ animation: 'sw-in 0.6s ease both', animationDelay: '11.3s' }}
          >
            Your achievements deserve to go further.
          </p>
        </div>
      </div>

      <SceneTrophy />
      <SceneNetwork />
      <SceneVault />
      <SceneVerify />
    </div>
  );
}

// Static, fully readable fallback for visitors who prefer reduced motion.
function StaticStory() {
  return (
    <section id="story" className="relative px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto mb-10 max-w-3xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">How BlockWard works</p>
        <h2 className="font-display text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
          From achievement to opportunity
        </h2>
      </div>
      <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
        {BEATS.map((b) => (
          <div key={b.text} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="font-display text-lg text-white">{b.text}</p>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-white/10 bg-[#0D1424] p-5">
        <VerificationCard instant />
      </div>
      <div className="mt-12 text-center">
        <h3 className="font-display text-2xl font-black text-white sm:text-3xl md:text-4xl">
          Your achievements deserve to go further.
        </h3>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" className="h-12 px-8 text-base" onClick={() => (window.location.href = '/Signup')}>
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 bg-transparent px-8 text-base text-white border-white/20 hover:bg-white/5"
            onClick={() => document.getElementById('own')?.scrollIntoView({ behavior: 'smooth' })}
          >
            See How It Works
          </Button>
        </div>
      </div>
    </section>
  );
}

// All story keyframes — namespaced `sw-` so nothing leaks into other pages.
const STORY_CSS = `
@keyframes sw-in { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes sw-out { to { opacity: 0; } }
@keyframes sw-pop { from { opacity: 0; transform: scale(1.4); } to { opacity: 1; transform: scale(1); } }
@keyframes sw-trophy-in { from { opacity: 0; transform: scale(0.72) translateY(26px); } to { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes sw-float { from { transform: rotate(-2.5deg); } to { transform: rotate(2.5deg); } }
@keyframes sw-draw { from { stroke-dashoffset: 320; } to { stroke-dashoffset: 0; } }
@keyframes sw-pulse-op { from { opacity: 0.2; } to { opacity: 0.75; } }
@keyframes sw-vault-in { from { opacity: 0; transform: translateY(28px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes sw-slide-row { from { opacity: 0; transform: translateX(-110%); } to { opacity: 1; transform: translateX(0); } }
@keyframes sw-slot-glow { 0%, 100% { box-shadow: 0 0 0 rgb(37_99_235/0); } 50% { box-shadow: 0 0 22px rgb(37_99_235/0.35); } }
@keyframes sw-laptop-in { from { opacity: 0; transform: translateY(30px) scale(0.94); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes sw-fly {
  0% { opacity: 0; transform: translate(-50%, -50%) translateX(-230px) scale(1); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -50%) translateX(0) scale(0.42); }
}
`;