import React from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, BadgeCheck, Share2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

const STEPS = [
  {
    icon: PlusCircle,
    title: 'Add an achievement',
    desc: 'Bring together accomplishments from school, clubs and beyond.',
  },
  {
    icon: BadgeCheck,
    title: 'Get it verified',
    desc: 'Ask the relevant teacher, coach or organisation to confirm it.',
  },
  {
    icon: Share2,
    title: 'Share your profile',
    desc: 'Give people one place to explore your achievements and their verification details.',
  },
];

/**
 * HowItWorks — compact three-step explainer below the hero, plus a modest
 * callout for schools and organisations. Fully static: readable even if
 * every animation and effect fails.
 */
export default function HowItWorks() {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-10 border-t border-border">
      <div className="max-w-[1200px] mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight text-center leading-tight">
          From achievement to a profile you can share.
        </h2>

        <div className="mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 max-w-4xl mx-auto">
          {STEPS.map((s, i) => (
            <div key={s.title} className="text-center sm:px-2">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <s.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-4 text-xs font-semibold text-primary">
                Step {i + 1}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* School / organisation callout */}
        <div className="mt-12 sm:mt-16 max-w-3xl mx-auto rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-foreground">
              Supporting students at your school or club?
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Manage learning, recognise progress and verify achievements.
            </p>
          </div>
          <Button variant="outline" size="lg" className="h-12 px-6 shrink-0 w-full sm:w-auto" asChild>
            <Link to={createPageUrl('ForOrganisations')}>
              Explore BlockWard for organisations
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}