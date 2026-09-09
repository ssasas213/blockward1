import React, { useEffect, useState } from 'react';
import { Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NotAStudentDialog from '@/components/auth/NotAStudentDialog';

export default function SiteHeader({ user, profile, navLinks, ctaLabel = 'Get Started', onSignIn, onGetStarted, onDashboard }) {
  const [scrolled, setScrolled] = useState(false);
  const [notAStudentOpen, setNotAStudentOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const ghostText = cn(
    "text-sm transition-colors",
    scrolled ? "text-muted-foreground hover:text-foreground" : "text-white/70 hover:text-white"
  );

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-200",
      scrolled ? "bg-sidebar border-b border-border" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className={cn(
            "font-semibold text-base tracking-tight transition-colors",
            scrolled ? "text-foreground" : "text-white"
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
              <button
                onClick={() => setNotAStudentOpen(true)}
                className={cn(ghostText, "hidden sm:block")}
              >
                Not a student?
              </button>
              <button onClick={onSignIn} className={ghostText}>
                Sign In
              </button>
              <Button onClick={onGetStarted || onSignIn} size="sm">
                {ctaLabel} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <NotAStudentDialog open={notAStudentOpen} onOpenChange={setNotAStudentOpen} context="marketing" />
    </header>
  );
}