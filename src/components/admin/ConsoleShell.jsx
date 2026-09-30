import React from 'react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Building2, FileText, ScrollText, ArrowLeft } from 'lucide-react';
import BlockwardLogo from '@/components/brand/BlockwardLogo';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'organisations', label: 'Organisations', icon: Building2 },
  { id: 'credentials', label: 'Credentials', icon: FileText },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
];

/** Internal operations shell — a separate control interface, not a holder dashboard. */
export default function ConsoleShell({ admin, tab, setTab, children }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass border-b border-border">
        <div className="max-w-6xl mx-auto h-14 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BlockwardLogo size="sm" />
            <span className="px-1.5 py-0.5 rounded-md border border-primary/30 bg-primary/15 text-[10px] font-semibold uppercase tracking-wide text-primary">Internal</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-tertiary">{admin?.email}</span>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to Blockward
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">
        <nav className="lg:w-52 flex-shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                  tab === t.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-hover hover:text-foreground'
                )}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>
        </nav>
        <main className="flex-1 min-w-0 animate-page-in">{children}</main>
      </div>
    </div>
  );
}