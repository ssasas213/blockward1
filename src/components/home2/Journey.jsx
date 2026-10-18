import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import {
  TrophyScene,
  CredentialScene,
  AnchorScene,
  VaultScene,
  ShareScene,
  VerifyScene,
} from '@/components/home2/journey/scenes';

// The signature journey — one continuous, scroll-choreographed sequence:
// earned → issued → anchored → kept → shared → verified.
// The trophy literally shrinks into the credential it becomes; every other
// stage crossfades through the same shared progress value, so the page reads
// as one directed take, not six slides.
// Reduced motion: collapses to a still six-panel strip.

const STEPS = [
  { n: '01', title: 'Earned', line: 'An achievement is earned — a competition win, a qualification, an award.' },
  { n: '02', title: 'Issued', line: 'A trusted organisation checks it and issues a digital credential.' },
  { n: '03', title: 'Anchored', line: 'A cryptographic fingerprint of the credential is recorded on Polygon.' },
  { n: '04', title: 'Kept', line: 'It enters your BlockWard Vault — a record you own.' },
  { n: '05', title: 'Shared', line: 'You share it with a university or employer with a single link.' },
  { n: '06', title: 'Verified', line: 'They independently check the issuer, the status and the integrity.' },
];
const SCENES = [TrophyScene, CredentialScene, AnchorScene, VaultScene, ShareScene, VerifyScene];

// Scroll window for stage i: [i/6, (i+1)/6], with a small crossfade band
// around each boundary.
function layerRange(index) {
  const b0 = index / 6;
  const b1 = (index + 1) / 6;
  if (index === 0) return { range: [0, b1 - 0.02, b1 + 0.02], o: [1, 1, 0], y: [0, 0, -24] };
  if (index === 5) return { range: [b0 - 0.02, b0 + 0.02, 1], o: [0, 1, 1], y: [24, 0, 0] };
  return { range: [b0 - 0.02, b0 + 0.02, b1 - 0.02, b1 + 0.02], o: [0, 1, 1, 0], y: [24, 0, 0, -24] };
}

function SceneLayer({ progress, index, children }) {
  const { range, o, y } = layerRange(index);
  const opacity = useTransform(progress, range, o);
  const ty = useTransform(progress, range, y);
  const one = useTransform(progress, [0, 1], [1, 1]);
  const b1 = (index + 1) / 6;
  // Stage 1→2: the trophy scales down into the credential it becomes.
  const shrink = useTransform(progress, [b1 - 0.02, b1 + 0.02], [1, 0.45]);
  const scale = index === 0 ? shrink : one;
  return (
    <motion.div
      style={{ opacity, y: ty, scale }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div className="scale-[0.7] sm:scale-90 lg:scale-100">{children}</div>
    </motion.div>
  );
}

function CaptionLayer({ progress, index, step }) {
  const { range, o, y } = layerRange(index);
  const opacity = useTransform(progress, range, o);
  const ty = useTransform(progress, range, y);
  return (
    <motion.div style={{ opacity, y: ty }} className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
      <p className="text-[11px] font-mono tracking-[0.25em] text-primary uppercase mb-3">
        Step {step.n} · {step.title}
      </p>
      <p className="text-lg sm:text-2xl text-white/85 max-w-xl leading-snug font-light">{step.line}</p>
    </motion.div>
  );
}

function NumeralLayer({ progress, index, n }) {
  const { range, o } = layerRange(index);
  const opacity = useTransform(progress, range, o.map((v) => v * 0.05));
  return (
    <motion.p
      style={{ opacity }}
      className="absolute inset-0 flex items-center justify-center font-display font-black text-[30vw] lg:text-[300px] text-white pointer-events-none select-none leading-none"
    >
      {n}
    </motion.p>
  );
}

function StaticStrip() {
  return (
    <section id="journey" className="py-24 px-4 sm:px-6 lg:px-8 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary text-center mb-14">
          How BlockWard works
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
          {STEPS.map((s, i) => {
            const Scene = SCENES[i];
            return (
              <div key={s.n} className="flex flex-col items-center text-center">
                <div className="scale-[0.8] origin-top">
                  <Scene />
                </div>
                <p className="text-[11px] font-mono tracking-widest text-primary uppercase mt-6 mb-2">
                  Step {s.n} · {s.title}
                </p>
                <p className="text-sm text-white/60 leading-relaxed max-w-[240px]">{s.line}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Journey() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  if (reduced) return <StaticStrip />;

  return (
    <section id="journey" ref={ref} className="relative scroll-mt-0" style={{ height: '480vh' }}>
      <div className="sticky top-0 h-screen overflow-hidden flex flex-col">
        <div className="pt-24 text-center px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">How BlockWard works</p>
        </div>

        <div className="relative flex-1">
          {SCENES.map((Scene, i) => (
            <NumeralLayer key={`n${i}`} progress={scrollYProgress} index={i} n={STEPS[i].n} />
          ))}
          {SCENES.map((Scene, i) => (
            <SceneLayer key={i} progress={scrollYProgress} index={i}>
              <Scene />
            </SceneLayer>
          ))}
        </div>

        <div className="relative h-28 pb-10">
          {STEPS.map((s, i) => (
            <CaptionLayer key={s.n} progress={scrollYProgress} index={i} step={s} />
          ))}
        </div>

        {/* Progress rail */}
        <div className="absolute right-6 lg:right-10 top-1/2 -translate-y-1/2 hidden md:block">
          <div className="relative h-56 w-px bg-white/10">
            <motion.div
              className="absolute inset-x-0 top-0 h-full bg-primary origin-top"
              style={{ scaleY: scrollYProgress }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}