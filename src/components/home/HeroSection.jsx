import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Layers, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import Hero3DBackground from './Hero3DBackground';

export default function HeroSection({ onSignIn, onWatchDemo }) {
  return (
    <section id="top" className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950">
      {/* 3D animated background */}
      <Hero3DBackground />
      {/* gradient overlays for legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/30 to-slate-950 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.7)_100%)] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-20 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/15 backdrop-blur-md text-violet-200 text-sm font-medium mb-8"
        >
          <Sparkles className="h-4 w-4" />
          Digital Custodian · Blockchain · AI
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white mb-6 leading-[1.05] tracking-tight"
        >
          Where Achievements
          <span className="block mt-2 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
            Become Permanent
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-lg sm:text-xl text-slate-300 mb-10 max-w-3xl mx-auto leading-relaxed"
        >
          BlockWard helps schools, organisations, sports clubs, academies, and companies verify
          achievements, secure records, and preserve accomplishments permanently.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button
            size="lg"
            onClick={() => window.location.href = createPageUrl('Login')}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-base px-8 py-6 shadow-2xl shadow-violet-600/30 border-0"
          >
            <Layers className="mr-2 h-5 w-5" />
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onWatchDemo}
            className="text-base px-8 py-6 border-white/15 text-white bg-white/5 hover:bg-white/10 backdrop-blur-md"
          >
            <Play className="mr-2 h-5 w-5" />
            Watch Demo
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-6 text-sm text-slate-500"
        >
          Verify. Authorise. Preserve.
        </motion.p>
      </div>

      {/* scroll cue */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-1.5"
        >
          <div className="w-1 h-2 rounded-full bg-white/40" />
        </motion.div>
      </div>
    </section>
  );
}