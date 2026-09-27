import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowRight } from 'lucide-react';

/**
 * BrandHeader — the consistent top bar for all public BlockWard surfaces
 * (verification pages, external-verifier pages). These pages may be the
 * first thing a university, employer or independent verifier ever sees, so
 * every public route carries the same professional branding.
 */
export default function BrandHeader() {
  return (
    <header className="border-b border-border bg-secondary">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-foreground tracking-tight">BlockWard</span>
        </Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          Learn about BlockWard <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  );
}