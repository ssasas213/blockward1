import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import HeroFilm from '@/components/home2/HeroFilm';

// Full-screen cinematic hero: the BlockWard story film plays edge-to-edge
// behind the headline, supporting copy and CTAs. A restrained dark overlay
// keeps every word readable on top of the footage.

export default function Hero() {
  const rise = (delay) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] },
  });

  const goToStory = () => {
    document.getElementById('own')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="top" className="relative flex min-h-[92vh] items-center overflow-hidden lg:min-h-screen">
      <HeroFilm />

      {/* Restrained dark overlay — readability, not a blackout */}
      <div className="pointer-events-none absolute inset-0 bg-[#0A0F1A]/45" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0A0F1A]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#0A0F1A]/70 to-transparent" />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-24 pt-32 sm:px-6 lg:px-8 lg:pb-32 lg:pt-40">
        <div className="max-w-2xl">
          <motion.p {...rise(0)} className="mb-7 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Blockchain-anchored digital credentials
          </motion.p>
          <motion.h1
            {...rise(0.08)}
            className="mb-7 font-display text-5xl font-black leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-[4.4rem] [text-shadow:0_2px_28px_rgb(0_0_0/0.55)]"
          >
            Proof of what you've achieved.
          </motion.h1>
          <motion.p
            {...rise(0.16)}
            className="mb-10 max-w-lg text-lg leading-relaxed text-white/75 [text-shadow:0_1px_16px_rgb(0_0_0/0.6)]"
          >
            BlockWard turns achievements into verified digital credentials — issued by trusted
            organisations, kept in your personal Vault, and checkable by any university or
            employer in seconds.
          </motion.p>
          <motion.div {...rise(0.24)} className="mb-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="h-12 px-8 text-base" onClick={() => (window.location.href = '/Signup')}>
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 bg-transparent px-8 text-base text-white border-white/20 hover:bg-white/5"
              onClick={goToStory}
            >
              See how it works
            </Button>
          </motion.div>
          <motion.p {...rise(0.32)} className="text-sm text-white/60 [text-shadow:0_1px_12px_rgb(0_0_0/0.6)]">
            Issuing achievements?{' '}
            <a href="/register-organisation" className="text-brand-violet hover:underline">
              Register your organisation →
            </a>
          </motion.p>
        </div>
      </div>
    </section>
  );
}