import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LayoutDashboard, Shield, Rss, BookOpen, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { name: 'Home', icon: LayoutDashboard, page: 'StudentDashboard' },
  { name: 'BlockWards', icon: Shield, page: 'StudentBlockWards' },
  { name: 'Explore', icon: Rss, page: 'Feed' },
  { name: 'School', icon: BookOpen, page: 'MySchool' },
  { name: 'Inbox', icon: Inbox, page: 'Messages' },
];

/**
 * StudentBottomTabs — the student nav as a mobile bottom tab bar (students
 * get no slide-in sidebar on mobile; desktop keeps the sidebar). The School
 * tab only appears once the student has an active organisation membership.
 */
export default function StudentBottomTabs({ currentPageName, hasSchool }) {
  const tabs = hasSchool ? TABS : TABS.filter((t) => t.page !== 'MySchool');
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-border">
      <div className={cn('grid', tabs.length === 5 ? 'grid-cols-5' : 'grid-cols-4')}>
        {tabs.map(t => {
          const active = currentPageName === t.page;
          return (
            <Link
              key={t.page}
              to={createPageUrl(t.page)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-5 w-5" />
              <span>{t.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}