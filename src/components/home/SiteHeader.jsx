import React, { useEffect, useState } from 'react';
import { Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function SiteHeader({ user, profile, onSignIn, onDashboard }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Industries', href: '#industries' },
    { label: 'Features', href: '#features' },
    { label: 'Demo', href: '#demo' },
  ];

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-200",
      scrolled ? "bg-slate-950/80 backdrop-blur-md border-b border-white/10" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-white" />
          <span className="font-semibold text-base text-white tracking-tight">BlockWard</span>
        </a>

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user && profile ? (
            <Button onClick={onDashboard} size="sm" className="bg-white text-slate-900 hover:bg-slate-200">
              Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <>
              <button onClick={onSignIn} className="text-sm text-slate-400 hover:text-white transition-colors">
                Sign In
              </button>
              <Button onClick={onSignIn} size="sm" className="bg-white text-slate-900 hover:bg-slate-200">
                Get Started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}