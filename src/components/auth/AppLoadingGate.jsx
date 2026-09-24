import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Full-screen loading gate with a timeout — a stalled backend shows a clear
// error with retry instead of an indefinite spinner. Used for the app-level
// auth/settings loading state and the lazy-route Suspense fallback.
export default function AppLoadingGate({ timeoutMs = 15000, message = 'Loading BlockWard…' }) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(t);
  }, [timeoutMs]);

  if (!timedOut) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold text-foreground mb-1">Taking longer than expected</h1>
        <p className="text-sm text-muted-foreground mb-5">
          We couldn't finish loading your session. This is usually temporary — try again.
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Try again
          </Button>
          <Button variant="outline" onClick={() => { window.location.href = '/'; }}>
            Go to home
          </Button>
        </div>
      </div>
    </div>
  );
}