import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Pause, Play, RotateCcw } from 'lucide-react';
import { BlockwardMark } from '@/components/brand/BlockwardLogo';

// The BlockWard film — one continuous 17.5s cinematic sequence:
//   [rendered] trophy → credential (6s) → fingerprint anchored on Polygon (6s)
//   [live UI]  Vault (3s) → share (2.5s) → independent verification (3.5s) → end card (2.5s)
// Rendered footage for the physical/abstract beats; real product UI for the
// Vault and verification beats. Autoplays muted in view; pause/replay
// controls; poster; reduced-motion fallback.

const VIDEO_TROPHY =
  'https://media.base44.com/videos/public/6936b840baa53bb465f68d09/151da46c3_Trophy_to_Credential.mp4';
const VIDEO_ANCHOR =
  'https://media.base44.com/videos/public/6936b840baa53bb465f68d09/0d161f111_Blockchain_Anchor.mp4';
const POSTER =
  'https://media.base44.com/images/public/6936b840baa53bb465f68d09/9574546b0_generated_image.png';

const PHASES = [
  { key: 'trophy', type: 'video', duration: 6, src: VIDEO_TROPHY, caption: 'An achievement is earned. A trusted organisation verifies and issues it.' },
  { key: 'anchor', type: 'video', duration: 6, src: VIDEO_ANCHOR, caption: 'A cryptographic fingerprint of the credential is anchored on Polygon.' },
  { key: 'vault', type: 'ui', duration: 3, caption: 'It enters your BlockWard Vault.' },
  { key: 'share', type: 'ui', duration: 2.5, caption: 'You share it with a future employer.' },
  { key: 'verify', type: 'ui', duration: 3.5, caption: 'They check it independently — issuer, status, integrity.' },
  { key: 'logo', type: 'ui', duration: 2.5, caption: null },
];
const TOTAL = PHASES.reduce((a, p) => a + p.duration, 0);

const STEPS = [
  ['01 · Earned', 'An achievement is earned — a competition win, a qualification, an award.'],
  ['02 · Issued', 'A trusted organisation checks it and issues a digital credential.'],
  ['03 · Anchored', 'A cryptographic fingerprint of the credential is recorded on Polygon.'],
  ['04 · Kept', 'It enters your BlockWard Vault — a record you own.'],
  ['05 · Shared', 'You share it with a university or employer with a single link.'],
  ['06 · Verified', 'They independently check the issuer, the status and the integrity.'],
];

/* ── Live-UI phases (CSS-animated, pausable via .film-paused) ─────────────── */

function VaultUI() {
  return (
    <div className="w-[340px] max-w-[86vw] rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_80px_rgb(0_0_0/0.5)]">
      <div className="flex items-center justify-between mb-4 f-fade">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/55">BlockWard Vault</p>
        <span className="font-mono text-[10px] text-white/35">04</span>
      </div>
      <div className="rounded-xl border border-primary/40 bg-primary/[0.09] p-3.5 flex items-center gap-3 f-rise">
        <div className="h-8 w-8 rounded-lg bg-primary/25 border border-primary/50 flex items-center justify-center flex-shrink-0">
          <Check className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] text-white leading-tight truncate">National Robotics Championship</p>
          <p className="text-[11px] text-white/45 mt-0.5">Meridian Institute of Technology</p>
        </div>
      </div>
      <div className="mt-2.5 space-y-2.5 opacity-40">
        <div className="rounded-xl border border-white/10 p-3.5 f-rise" style={{ animationDelay: '0.5s' }}>
          <p className="text-[13px] text-white">Advanced Lifeguard Certification</p>
          <p className="text-[11px] text-white/45 mt-0.5">Northgate Aquatics</p>
        </div>
        <div className="rounded-xl border border-white/10 p-3.5 f-rise" style={{ animationDelay: '0.9s' }}>
          <p className="text-[13px] text-white">Grade 8 Violin — Distinction</p>
          <p className="text-[11px] text-white/45 mt-0.5">City of Lakes Music Academy</p>
        </div>
      </div>
    </div>
  );
}

function ShareUI() {
  return (
    <div className="flex items-center gap-4 sm:gap-7">
      <div className="w-[165px] max-w-[38vw] rounded-xl border border-white/10 bg-white/[0.04] p-4 f-fade">
        <p className="text-[10px] uppercase tracking-widest text-white/45 mb-2">From your Vault</p>
        <p className="text-[13px] text-white leading-tight">National Robotics Championship</p>
        <p className="mt-2 font-mono text-[10px] text-white/40">BW-K4T2M9QP</p>
      </div>
      <div className="relative h-px w-12 sm:w-20 border-t border-dashed border-white/25 f-fade">
        <div className="f-dot absolute -top-[5px] left-0 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_hsl(217_84%_53%/0.8)]" />
      </div>
      <div className="w-[165px] max-w-[38vw] rounded-xl border border-white/10 bg-white/[0.04] p-4 f-fade" style={{ animationDelay: '1.4s' }}>
        <p className="text-[10px] uppercase tracking-widest text-white/45 mb-2">To</p>
        <p className="text-[13px] text-white leading-tight">Employer · Talent Team</p>
        <p className="mt-2 text-[11px] text-white/40">Verification link received</p>
      </div>
    </div>
  );
}

function VerifyUI() {
  const rows = [
    ['Issuer', 'Verified organisation'],
    ['Status', 'Active'],
    ['Integrity', 'Fingerprint matches anchor'],
  ];
  return (
    <div className="w-[320px] max-w-[86vw] rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_80px_rgb(0_0_0/0.5)]">
      <p className="text-[10px] uppercase tracking-widest text-white/45 mb-4 f-fade">Independently checked</p>
      <div className="space-y-3">
        {rows.map(([k, v], i) => (
          <div key={k} className="flex items-center justify-between gap-4 f-rise" style={{ animationDelay: `${0.3 + i * 0.55}s` }}>
            <span className="text-[13px] text-white/70">{k}</span>
            <span className="flex items-center gap-2 text-[13px] text-white text-right">
              <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              {v}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between f-stamp" style={{ animationDelay: '2.2s' }}>
        <span className="text-[13px] font-semibold text-white">Authentic</span>
        <span className="font-mono text-[10px] text-white/40">Polygon PoS</span>
      </div>
    </div>
  );
}

function LogoUI() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center gap-4"
    >
      <BlockwardMark size="xl" />
      <p className="font-display font-black text-4xl text-white tracking-tight">BlockWard</p>
      <p className="text-xs uppercase tracking-[0.25em] text-white/40">Proof of what you've achieved</p>
    </motion.div>
  );
}

const UI_PHASES = { vault: <VaultUI />, share: <ShareUI />, verify: <VerifyUI />, logo: <LogoUI /> };

/* ── Reduced-motion fallback: poster + step strip, no animation ───────────── */

function StaticFilm() {
  return (
    <section id="journey" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 scroll-mt-0">
      <div className="max-w-4xl mx-auto">
        <img
          src={POSTER}
          alt="Golden trophy on a dark stage — still from the BlockWard story"
          className="w-full rounded-2xl border border-white/10"
        />
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
          {STEPS.map(([kicker, line]) => (
            <div key={kicker}>
              <p className="text-[11px] font-mono tracking-widest text-primary uppercase mb-2">{kicker}</p>
              <p className="text-sm text-white/60 leading-relaxed">{line}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Player ───────────────────────────────────────────────────────────────── */

export default function Film() {
  const videoARef = useRef(null);
  const videoBRef = useRef(null);
  const stageRef = useRef(null);
  const startedRef = useRef(false);
  const uiElapsedRef = useRef(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const advance = () => {
    if (phaseIdx >= PHASES.length - 1) {
      uiElapsedRef.current = 0;
      setEnded(true);
      setPlaying(false);
      return;
    }
    uiElapsedRef.current = 0;
    setPhaseIdx(phaseIdx + 1);
  };

  // Phase clock — videos self-advance via onEnded; this is the UI clock and a
  // safety net for video phases (+1.2s buffer) if a video cannot play.
  useEffect(() => {
    if (!playing || ended) return;
    const phase = PHASES[phaseIdx];
    const limit = phase.type === 'video' ? phase.duration + 1.2 : phase.duration;
    let raf;
    let last = performance.now();
    const tick = (ts) => {
      uiElapsedRef.current += ts - last;
      last = ts;
      if (uiElapsedRef.current >= limit * 1000) {
        advance();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, phaseIdx, ended]);

  // Video play/pause sync.
  useEffect(() => {
    const videos = [videoARef.current, videoBRef.current];
    if (!playing) {
      videos.forEach((v) => v && !v.paused && v.pause());
      return;
    }
    const phase = PHASES[phaseIdx];
    if (phase.type === 'video') {
      const v = phase.key === 'trophy' ? videoARef.current : videoBRef.current;
      v?.play().catch(() => {});
    }
  }, [playing, phaseIdx]);

  // Autostart once, when the film scrolls into view (muted, so allowed).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !startedRef.current) {
          startedRef.current = true;
          setStarted(true);
          setPlaying(true);
          obs.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const replay = () => {
    uiElapsedRef.current = 0;
    [videoARef.current, videoBRef.current].forEach((v) => {
      if (v) v.currentTime = 0;
    });
    setEnded(false);
    setPhaseIdx(0);
    setPlaying(true);
  };

  if (reduced) return <StaticFilm />;

  const phase = PHASES[phaseIdx];
  const paused = started && !playing && !ended;

  return (
    <section id="journey" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 scroll-mt-0">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10 px-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">The BlockWard story</p>
          <h2 className="font-display font-black text-3xl sm:text-5xl text-white tracking-tight">From achievement to proof.</h2>
        </div>

        {/* Stage */}
        <div
          ref={stageRef}
          className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/10 bg-[#0A0F1A] shadow-[0_40px_120px_rgb(0_0_0/0.55)]"
        >
          <video
            ref={videoARef}
            src={VIDEO_TROPHY}
            poster={POSTER}
            muted
            playsInline
            preload="auto"
            onEnded={advance}
            onError={advance}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${phase.key === 'trophy' && !ended ? 'opacity-100' : 'opacity-0'}`}
          />
          <video
            ref={videoBRef}
            src={VIDEO_ANCHOR}
            muted
            playsInline
            preload="auto"
            onEnded={advance}
            onError={advance}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${phase.key === 'anchor' && !ended ? 'opacity-100' : 'opacity-0'}`}
          />

          {/* Live-UI phases */}
          {started && phase.type === 'ui' && (
            <div key={phase.key} className={`absolute inset-0 flex items-center justify-center ${paused ? 'film-paused' : ''}`}>
              {UI_PHASES[phase.key]}
            </div>
          )}

          {/* Poster until first start */}
          {!started && <img src={POSTER} alt="" className="absolute inset-0 h-full w-full object-cover" />}

          {/* Caption */}
          {started && !ended && phase.caption && (
            <div className="absolute bottom-5 left-0 right-0 px-6 text-center pointer-events-none">
              <p className="text-sm sm:text-base text-white/90 font-light drop-shadow-[0_1px_8px_rgb(0_0_0/0.8)]">{phase.caption}</p>
            </div>
          )}

          {/* Start overlay */}
          {!started && (
            <button
              onClick={() => {
                startedRef.current = true;
                setStarted(true);
                setPlaying(true);
              }}
              className="absolute inset-0 z-10 flex items-center justify-center group"
              aria-label="Play the BlockWard story"
            >
              <span className="h-16 w-16 rounded-full bg-white/10 border border-white/25 backdrop-blur flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Play className="h-6 w-6 text-white ml-1" />
              </span>
            </button>
          )}

          {/* End overlay */}
          {ended && (
            <button onClick={replay} className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 group" aria-label="Replay film">
              <span className="h-16 w-16 rounded-full bg-white/10 border border-white/25 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <RotateCcw className="h-6 w-6 text-white" />
              </span>
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => setPlaying(!playing)}
            disabled={ended}
            className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center text-white/80 hover:bg-white/5 disabled:opacity-40 flex-shrink-0"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <button
            onClick={replay}
            className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center text-white/80 hover:bg-white/5 flex-shrink-0"
            aria-label="Replay"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <div className="flex-1 flex gap-1.5">
            {PHASES.map((p, i) => (
              <div key={p.key} className="relative h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
                {i < phaseIdx && <div className="absolute inset-0 bg-primary" />}
                {i === phaseIdx && started && !ended && (
                  <div
                    key={`${p.key}-${started}`}
                    className={`absolute inset-y-0 left-0 bg-primary f-progress ${paused ? 'film-paused' : ''}`}
                    style={{ animationDuration: `${p.duration}s` }}
                  />
                )}
              </div>
            ))}
          </div>
          <span className="font-mono text-[11px] text-white/40 flex-shrink-0">0:17</span>
        </div>

        <p className="mt-5 text-center text-[11px] text-white/35">
          Trophy and blockchain footage is rendered; the Vault, sharing and verification beats are live product UI.
          Example data only.
        </p>
      </div>
    </section>
  );
}