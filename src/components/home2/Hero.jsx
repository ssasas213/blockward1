import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CredentialCard from '@/components/home2/CredentialCard';

export default function Hero() {
  const rise = (delay) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] },
  });

  const goToJourney = () => {
    document.getElementById('journey')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="top" className="relative overflow-hidden">
      {/* Single ambient light — one radial, no blobs */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 55% 45% at 72% 38%, hsl(217 84% 53% / 0.10), transparent 65%)' }}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 lg:pt-44 lg:pb-32 grid lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center">
        <div>
          <motion.p {...rise(0)} className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-7">
            Blockchain-anchored digital credentials
          </motion.p>
          <motion.h1
            {...rise(0.08)}
            className="font-display font-black text-5xl sm:text-6xl lg:text-[4.4rem] text-white leading-[1.02] tracking-tight mb-7"
          >
            Proof of what you've achieved.
          </motion.h1>
          <motion.p {...rise(0.16)} className="text-lg text-white/60 leading-relaxed max-w-lg mb-10">
            BlockWard turns achievements into verified digital credentials — issued by trusted
            organisations, kept in your personal Vault, and checkable by any university or
            employer in seconds.
          </motion.p>
          <motion.div {...rise(0.24)} className="flex flex-col sm:flex-row gap-3 mb-8">
            <Button size="lg" className="h-12 px-8 text-base" onClick={() => (window.location.href = '/Signup')}>
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base bg-transparent border-white/15 text-white hover:bg-white/5"
              onClick={goToJourney}
            >
              See how it works
            </Button>
          </motion.div>
          <motion.p {...rise(0.32)} className="text-sm text-white/40">
            Issuing achievements?{' '}
            <a href="/register-organisation" className="text-brand-violet hover:underline">
              Register your organisation →
            </a>
          </motion.p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <CredentialCard />
        </div>
      </div>
    </section>
  );
}