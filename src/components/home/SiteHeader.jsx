import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowRight, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function SiteHeader({ user, profile, navLinks, ctaLabel = 'Get Started', onSignIn, onGetStarted, onDashboard }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const ghostText = cn(
    "text-sm transition-colors",
    scrolled || menuOpen ? "text-muted-foreground hover:text-foreground" : "text-white/70 hover:text-white"
  );

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-200",
      scrolled || menuOpen ? "bg-sidebar border-b border-border" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className={cn(
            "font-semibold text-base tracking-tight transition-colors",
            scrolled || menuOpen ? "text-foreground" : "text-white"
          )}>BlockWard</span>
        </a>

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm transition-colors",
                scrolled ? "text-muted-foreground hover:text-foreground" : "text-white/70 hover:text-white"
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user && profile ? (
            <Button onClick={onDashboard} size="sm">
              Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <>
              {/* Professional access is a first-class link, not hidden behind
                  "Not a student?" */}
              <Link to="/schools/login" className={cn(ghostText, "hidden sm:block")}>
                Teachers &amp; school admins
              </Link>
              <button onClick={onSignIn} className={ghostText}>
                Sign In
              </button>
              <Button onClick={onGetStarted || onSignIn} size="sm">
                {ctaLabel} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </>
          )}
          {/* Mobile menu toggle — the desktop nav, staff entry and CTAs all
              stay reachable on small screens */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className={cn("md:hidden p-1.5 rounded-md hover:bg-hover", ghostText)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-sidebar px-4 py-4">
          <div className="space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="pt-3 mt-2 border-t border-border space-y-1">
            <Link
              to="/schools/login"
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm text-foreground font-medium hover:bg-hover transition-colors"
            >
              Teachers &amp; school admins
            </Link>
            {user && profile ? (
              <Button onClick={() => { setMenuOpen(false); onDashboard(); }} size="sm" className="w-full mt-1">
                Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <div className="px-3 pt-2 space-y-3">
                <button
                  onClick={() => { setMenuOpen(false); onSignIn(); }}
                  className="block w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign In
                </button>
                <Button onClick={() => { setMenuOpen(false); (onGetStarted || onSignIn)(); }} size="sm" className="w-full">
                  {ctaLabel} <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}