import React from 'react';
import { ArrowRight, Search } from 'lucide-react';
import Reveal from '@/components/home/Reveal';

export default function FinalCta() {
  return (
    <section className="mkt-light py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-slate-200">
      <div className="max-w-3xl mx-auto text-center">
        <Reveal>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mkt-ink uppercase leading-[1.1]">
            Your achievements took work. <span className="text-brand-gradient">The proof shouldn't.</span>
          </h2>
          <p className="text-base sm:text-lg mkt-sub mt-6 max-w-xl mx-auto leading-relaxed">
            Turn what you've achieved into a record that can be verified wherever you go.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => (window.location.href = '/Signup')}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-lg bg-brand-gradient text-white font-semibold text-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              Create Your Blockward Profile <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => (window.location.href = '/verify')}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium transition-all hover:border-slate-400 hover:bg-slate-50"
            >
              <Search className="h-4 w-4" />
              Verify a Credential
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}