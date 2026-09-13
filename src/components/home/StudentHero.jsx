import React from 'react';
import { ArrowRight, UserRoundSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import HeroBackground from '@/components/home/HeroBackground';

export default function StudentHero() {
  return (
    <section id="top" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <HeroBackground />
      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-32 pb-20">
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.05] tracking-tight">
          Your receipts.
          <br />
          All of them. <span className="text-brand-gradient">Verified.</span>
        </h1>

        <p className="text-lg sm:text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed font-light">
          Every award, belt, grade, win and role you've earned — in one link nobody can fake.
          Yours forever, even after you leave school.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            className="text-base px-8 h-12"
            onClick={() => window.location.href = createPageUrl('Signup')}
          >
            Claim your profile
            <ArrowRight className="ml-1 h-5 w-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-base px-8 h-12 bg-white/5 border-white/15 text-white hover:bg-white/10 hover:border-white/25"
            onClick={() => window.location.href = createPageUrl('DemoProfile')}
          >
            <UserRoundSearch className="mr-1 h-5 w-5" />
            See an example profile
          </Button>
        </div>

        <p className="mt-10 text-sm text-white/40">
          Free for students · Set up in minutes · No crypto knowledge needed
        </p>
      </div>
    </section>
  );
}