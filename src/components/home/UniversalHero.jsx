import React from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import HeroBackground from '@/components/home/HeroBackground';
import HeroProduct from '@/components/home/HeroProduct';

export default function UniversalHero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <HeroBackground />
      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-32 pb-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/70 mb-8">
          Blockchain-backed achievement verification
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.05] tracking-tight">
          Make Every Achievement
          <br />
          <span className="text-brand-gradient">Verifiable.</span>
        </h1>

        <p className="text-base sm:text-lg text-white/70 mb-4 max-w-2xl mx-auto leading-relaxed font-light">
          Your achievements shouldn't rely on a PDF, screenshot or piece of paper.
        </p>
        <p className="text-sm sm:text-base text-white/55 mb-10 max-w-2xl mx-auto leading-relaxed">
          Blockward connects them to the organisation that issued them, records authorised
          verification, and gives you proof anyone can check in seconds.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" className="text-base px-8 h-12" onClick={() => (window.location.href = '/Signup')}>
            Create Your Profile
            <ArrowRight className="ml-1 h-5 w-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-base px-8 h-12 bg-white/5 border-white/15 text-white hover:bg-white/10 hover:border-white/25"
            onClick={() => (window.location.href = '#verify')}
          >
            <Search className="mr-1 h-5 w-5" />
            Verify a Credential
          </Button>
        </div>

        <p className="mt-6 text-sm text-white/40">
          Issuing achievements?{' '}
          <a href="/register-organisation" className="text-brand-violet hover:underline">
            Register your organisation →
          </a>
        </p>

        <HeroProduct />
      </div>
    </section>
  );
}