import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LayoutDashboard, Shield, UserCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { name: 'Today', icon: LayoutDashboard, page: 'StudentDashboard' },
  { name: 'Achievements', icon: Shield, page: 'Achievements' },
  { name: 'Credentials', icon: FileText, page: 'StudentBlockWards' },
  { name: 'Profile', icon: UserCircle, page: 'Profile' },
];

/**
 * StudentBottomTabs — the student nav as a mobile bottom tab bar (students
 * get no slide-in sidebar on mobile; desktop keeps the sidebar). The School
 * tab only appears once the student has an active organisation membership.
 */
export default function StudentBottomTabs({ currentPageName }) {
  const tabs = TABS;
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-border">
      <div className={cn('grid', 'grid-cols-4')}>
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