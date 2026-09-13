import React from 'react';
import { ArrowRight, UserRoundSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExampleProfilePreview from '@/components/home/ExampleProfilePreview';

/**
 * StudentHero — two-column hero: copy on the left, the product itself
 * (a labelled example profile preview) on the right. Auth-aware: signed-in
 * visitors get "Go to dashboard" instead of the signup CTA.
 */
export default function StudentHero({ user, profile, onSignUp, onExplore, onDashboard }) {
  const signedIn = !!(user && profile);

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10 pt-24 sm:pt-28 lg:pt-32 pb-16 lg:pb-24 grid lg:grid-cols-[1.05fr_0.95fr] items-center gap-12 lg:gap-16">
        {/* Left — headline, description, actions */}
        <div>
          <h1 className="text-white font-bold tracking-tight leading-[1.08] text-[clamp(2.25rem,5.4vw,4.25rem)]">
            Your achievements.
            <br />
            One profile. <span className="text-brand-gradient">Verified.</span>
          </h1>

          <p className="mt-5 sm:mt-6 text-lg leading-relaxed text-white/70 max-w-xl">
            Bring together your awards, grades, sporting milestones and more. Build a profile
            that shows what you&rsquo;ve achieved and who verified it.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="text-base px-7 h-12 w-full sm:w-auto justify-center"
              onClick={signedIn ? onDashboard : onSignUp}
            >
              {signedIn ? 'Go to dashboard' : 'Create your free profile'}
              <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-7 h-12 w-full sm:w-auto justify-center bg-white/5 border-white/15 text-white hover:bg-white/10 hover:border-white/25"
              onClick={onExplore}
            >
              <UserRoundSearch className="mr-1 h-5 w-5" />
              Explore an example
            </Button>
          </div>

          <p className="mt-8 text-sm text-white/40">
            Free for students · No school signup required
          </p>
        </div>

        {/* Right — the actual product, labelled as an example */}
        <div className="w-full">
          <ExampleProfilePreview />
        </div>
      </div>
    </section>
  );
}