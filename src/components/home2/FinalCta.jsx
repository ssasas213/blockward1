import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FinalCta() {
  return (
    <section className="border-t border-white/10 py-28 sm:py-36 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="font-display font-black text-4xl sm:text-6xl text-white leading-[1.05] tracking-tight mb-6">
          Start keeping proof of what you've achieved.
        </h2>
        <p className="text-white/55 max-w-xl mx-auto leading-relaxed mb-10">
          Create your Vault, connect an achievement, and let the organisation that issued it
          make it verifiable.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" className="h-12 px-8 text-base" onClick={() => (window.location.href = '/Signup')}>
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 px-8 text-base bg-transparent border-white/15 text-white hover:bg-white/5"
            onClick={() => (window.location.href = '/register-organisation')}
          >
            Register your organisation
          </Button>
        </div>
      </div>
    </section>
  );
}