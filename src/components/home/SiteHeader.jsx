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
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled ? "bg-slate-950/80 backdrop-blur-xl border-b border-white/10" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-105 transition-transform">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">BlockWard</span>
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-slate-300 hover:text-white transition-colors font-medium">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user && profile ? (
            <Button onClick={onDashboard} size="sm" className="bg-white text-slate-900 hover:bg-slate-100">
              Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button onClick={onSignIn} variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10">
                Sign In
              </Button>
              <Button onClick={onSignIn} size="sm" className="bg-white text-slate-900 hover:bg-slate-100">
                Get Started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}