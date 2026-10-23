import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BLOCKWARD_LOGO_URL =
  'https://media.base44.com/images/public/6936b840baa53bb465f68d09/baebdd78c_download.png';
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

  // Standard nav link tone.
  const ghostLink = cn(
    "transition-colors",
    scrolled || menuOpen ? "text-muted-foreground hover:text-foreground" : "text-white/70 hover:text-white"
  );

  // Accent nav link (BlockTalks) — Blockward-blue with a soft glow that warms
  // up on hover, distinct from the neutral ghost links.
  const accentText = cn(
    "font-medium",
    scrolled || menuOpen
      ? "text-primary hover:text-accent"
      : "text-brand-violet hover:text-blue-300 drop-shadow-[0_0_8px_rgb(37_99_235/0.35)] hover:drop-shadow-[0_0_10px_rgb(96_165_250/0.5)]"
  );

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-200",
      scrolled || menuOpen ? "bg-sidebar border-b border-border" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <img
            src={BLOCKWARD_LOGO_URL}
            alt="Blockward"
            className="h-7 w-auto"
            draggable={false}
          />
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
                link.accent ? accentText : ghostLink,
                "group relative text-sm transition-all duration-200",
              )}
            >
              {link.label}
              {/* Accent links get a subtle animated underline on hover */}
              {link.accent && (
                <span
                  className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-primary transition-transform duration-200 group-hover:scale-x-100"
                  aria-hidden="true"
                />
              )}
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
                className={cn(
                  "block rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-hover",
                  link.accent
                    ? "font-medium text-primary hover:text-accent"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="pt-3 mt-2 border-t border-border space-y-1">
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