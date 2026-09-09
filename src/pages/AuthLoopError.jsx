import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, RefreshCcw, Home, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearSignupSession } from '@/lib/signupSession';
import { resetRedirectLog } from '@/lib/authRedirectGuard';

/**
 * Rendered by the auth redirect guard (src/lib/authRedirectGuard.js) when
 * automatic redirects chain too fast. A visible error with a way out is
 * always better than an infinite refresh loop.
 */
export default function AuthLoopError() {
  const startOver = () => {
    clearSignupSession();
    resetRedirectLog();
    window.location.href = '/Signup';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12 accent-glow">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex h-14 w-14 rounded-2xl bg-destructive/10 items-center justify-center mb-5">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mb-8">
          We got stuck in a redirect while loading your account. Nothing was lost —
          starting over clears the stuck state and takes you back to sign-up.
        </p>
        <div className="space-y-3">
          <Button onClick={startOver} className="w-full font-medium py-2.5">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Start over
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/"><Home className="h-4 w-4 mr-2" />Back to home</Link>
          </Button>
        </div>
        <div className="flex items-center justify-center gap-2 mt-8 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" /> BlockWard · Blockchain-Secured Achievements
        </div>
      </div>
    </div>
  );
}