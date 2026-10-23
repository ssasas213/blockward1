import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * VerifyGrowthSection — the tasteful, single-purpose growth block shown at the
 * bottom of every public verification page. It never distracts from the
 * verification itself: it renders BELOW all credential details, uses muted
 * styling, and offers exactly two actions — discover the platform, or create
 * a profile.
 */
export default function VerifyGrowthSection() {
  return (
    <div className="mt-10 space-y-4">
      <div className="rounded-2xl border border-border surface-card p-6 text-center">
        <h2 className="font-display text-xl tracking-tight text-foreground">Your achievements deserve to be trusted.</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          Blockward helps individuals showcase achievements that organisations can independently verify.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/"><Building2 className="h-4 w-4" /> Discover Blockward</Link>
          </Button>
          <Button asChild>
            <Link to="/Signup">Create your profile <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 py-2 text-center">
        <p className="inline-flex items-center gap-1.5 text-xs text-tertiary">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Verified with <span className="font-semibold text-foreground">BlockWard</span>
        </p>
        <p className="text-xs text-tertiary">
          Turn your achievements into independently verifiable credentials.{' '}
          <Link to="/Signup" className="text-primary hover:underline font-medium">
            Create your free Blockward profile →
          </Link>
        </p>
      </div>
    </div>
  );
}