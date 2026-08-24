import React from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import HeroBackground from '@/components/home/HeroBackground';

export default function HeroSection({ onSignIn, onWatchDemo }) {
  return (
    <section id="top" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <HeroBackground />
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-24 pb-16">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-white mb-5 leading-[1.1] tracking-tight">
          Where achievements become permanent.
        </h1>

        <p className="text-base sm:text-lg text-white/70 mb-8 max-w-2xl mx-auto leading-relaxed">
          BlockWard helps schools, organisations, and clubs verify achievements, secure records,
          and preserve accomplishments permanently on the blockchain.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            onClick={() => window.location.href = createPageUrl('Signup')}
          >
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onWatchDemo}
          >
            <Play className="mr-2 h-4 w-4" />
            Watch Demo
          </Button>
        </div>

        <p className="mt-8 text-sm text-white/50">
          Verify · Authorise · Preserve
        </p>
      </div>
    </section>
  );
}