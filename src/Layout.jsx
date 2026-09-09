import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard, Users, BookOpen, Calendar, Award,
  FileText, Settings, LogOut, Menu, X, ChevronDown,
  Shield, UserCircle, Bell, BarChart3, Sparkles, Megaphone, Trophy, HardDrive, PenLine, Search, Send, GraduationCap, ClipboardList, ClipboardCheck, CalendarDays, Briefcase, Rss, Inbox, Globe
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import SignoffCountBadge from '@/components/sidebar/SignoffCountBadge';
import PendingTeachersBadge from '@/components/sidebar/PendingTeachersBadge';
import StudentBottomTabs from '@/components/sidebar/StudentBottomTabs';
import { Button } from '@/components/ui/button';
import SchoolSwitcher from '@/components/sidebar/SchoolSwitcher';
import ThemeToggle, { ThemeToggleCompact } from '@/components/sidebar/ThemeToggle';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import BlockWardGuide from '@/components/onboarding/BlockWardGuide';
import { TestModeBanner, TestModeMenuItems } from '@/components/testmode/TestModeBanner';
import UnverifiedSchoolBanner from '@/components/school/UnverifiedSchoolBanner';
import { useSchool } from '@/lib/SchoolContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getRoleLabel } from '@/lib/orgTypes';

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, profile, activeSchool: school, loading, testMode } = useSchool();

  const publicPages = ['Home', 'Login', 'Signup', 'SchoolSetup'];
  const isPublicPage = publicPages.includes(currentPageName);

  const logout = () => {
    base44.auth.logout(createPageUrl('Home'));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-primary animate-spin" />
      </div>
    );
  }

  if (isPublicPage || !user) {
    return (
      <div className="min-h-screen bg-background">{children}</div>
    );
  }

  // Test Super User: the active persona drives the nav/dashboard, not the
  // permanent user_type (which stays 'admin' so platform RLS still works).
  const isTestSuperUser = !!testMode?.isTestSuperUser;
  const userType = isTestSuperUser ? (testMode.activePersona || 'admin') : (profile?.user_type || 'student');

  const navigationGroups = {
    admin: [
      { items: [
        { name: 'Home', icon: LayoutDashboard, page: 'AdminDashboard' },
        { name: 'Approvals', icon: ClipboardCheck, page: 'PendingSignoffs', badge: 'signoffs' },
        { name: 'Records', icon: FileText, page: 'Records' },
        { name: 'People', icon: Users, page: 'People', badge: 'pendingTeachers' },
        { name: 'School', icon: BookOpen, page: 'ManageSchool' },
        { name: 'Insights', icon: BarChart3, page: 'Insights' },
        { name: 'Inbox', icon: Inbox, page: 'Messages' },
        { name: 'Settings', icon: Settings, page: 'SchoolSettings' },
      ]},
    ],
    teacher: [
      { items: [
        { name: 'Home', icon: LayoutDashboard, page: 'TeacherDashboard' },
        { name: 'Sign-offs', icon: ClipboardCheck, page: 'PendingSignoffs', badge: 'signoffs' },
        { name: 'Achievements', icon: Trophy, page: 'TeacherRecords' },
        { name: 'Teaching', icon: BookOpen, page: 'MyTeaching' },
        { name: 'Explore', icon: Rss, page: 'Feed' },
        { name: 'Inbox', icon: FileText, page: 'Messages' },
      ]},
    ],
    student: [
      { items: [
        { name: 'Home', icon: LayoutDashboard, page: 'StudentDashboard' },
        { name: 'My BlockWards', icon: Shield, page: 'StudentBlockWards' },
        { name: 'Explore', icon: Rss, page: 'Feed' },
        { name: 'School', icon: BookOpen, page: 'MySchool' },
        { name: 'Inbox', icon: Inbox, page: 'Messages' },
      ]},
    ],
  };

  let groups = navigationGroups[userType] || navigationGroups.student;
  // The School nav is meaningless without an active membership — hide it
  // entirely until the student has one. Joining an organisation is optional.
  if (userType === 'student' && !profile?.school_id) {
    groups = groups.map((g) => ({ ...g, items: g.items.filter((i) => i.page !== 'MySchool') }));
  }
  // Admin permission filtering now happens at the tab level inside the
  // grouped pages (ManageSchool / Insights / SchoolSettings), not per nav item.

  const orgType = school?.org_type || 'school';
  const orgRoleLabels = school?.settings?.role_labels;
  const roleLabel = orgRoleLabels?.[userType] || getRoleLabel(orgType, userType);
  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : user?.email;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 glass border-b border-border z-50 px-4 flex items-center justify-between">
        {userType === 'student' ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-full" aria-label="Account menu">
                <InitialsAvatar name={displayName} src={profile?.avatar_url} size="sm" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <TestModeMenuItems />
              <ThemeToggle />
              {profile?.handle && (
                <DropdownMenuItem asChild>
                  <a href={`/@${profile.handle}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    My profile
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to={createPageUrl('Profile')} className="flex items-center gap-2">
                  <UserCircle className="h-4 w-4" />
                  Profile & Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-hover rounded-md transition-colors" aria-label="Open menu">
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground text-sm">BlockWard</span>
        </div>
        <TestModeBanner />
        {(userType === 'teacher' || userType === 'admin') && (
          <Button variant="ghost" size="icon" asChild className="h-9 w-9 p-2" title="BlockWard AI">
            <Link to={createPageUrl('BlockWardAI')} aria-label="BlockWard AI">
              <Sparkles className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <NotificationBell userEmail={testMode?.isTestSuperUser && testMode.effectiveEmail ? testMode.effectiveEmail : user?.email} />
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && userType !== 'student' && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 surface-sidebar border-r border-sidebar-border shadow-2xl">
            <SidebarContent
              groups={groups}
              currentPageName={currentPageName}
              profile={profile}
              user={user}
              userType={userType}
              roleLabel={roleLabel}
              school={school}
              onClose={() => setSidebarOpen(false)}
              onLogout={logout}
            />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col surface-sidebar border-r border-sidebar-border z-30">
        <SidebarContent
          groups={groups}
          currentPageName={currentPageName}
          profile={profile}
          user={user}
          userType={userType}
          roleLabel={roleLabel}
          school={school}
          onLogout={logout}
        />
      </aside>

      {/* Desktop Top Bar */}
      <header className="hidden lg:flex fixed top-0 left-64 right-0 h-14 z-20 glass border-b border-border items-center gap-3 px-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
          <input
            type="text"
            placeholder="Search students, classes, achievements…"
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-secondary/60 border border-border text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-primary/40 focus:bg-secondary focus:ring-2 focus:ring-primary/15 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1">
          {(userType === 'teacher' || userType === 'admin') && (
            <Button variant="ghost" size="icon" asChild title="BlockWard AI">
              <Link to={createPageUrl('BlockWardAI')} aria-label="BlockWard AI">
                <Sparkles className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <TestModeBanner />
          <ThemeToggleCompact />
          <div className="h-6 w-px bg-border mx-1" />
          <NotificationBell userEmail={testMode?.isTestSuperUser && testMode.effectiveEmail ? testMode.effectiveEmail : user?.email} />
        </div>
      </header>

      {/* Main Content */}
      <main className={cn("lg:pl-64 lg:pt-14 pt-14 min-h-screen", userType === 'student' && "pb-16 lg:pb-0")}>
        <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto animate-page-in">
          <UnverifiedSchoolBanner />
          {children}
        </div>
      </main>

      {userType === 'student' && <StudentBottomTabs currentPageName={currentPageName} hasSchool={!!profile?.school_id} />}

      <BlockWardGuide />
    </div>
  );
}

function SidebarContent({ groups, currentPageName, profile, user, userType, roleLabel, school, onClose, onLogout }) {
  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : user?.email;
  return (
    <div className="flex flex-col h-full">
      {/* Logo + School Switcher */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border">
        <SchoolSwitcher onClose={onClose} />
        {onClose && (
          <button onClick={onClose} className="p-1.5 hover:bg-hover rounded-md lg:hidden" aria-label="Close menu">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {groups.map((group, gIdx) => (
          <div key={gIdx} className={group.label ? 'mb-5' : ''}>
            {group.label && (
              <p className="px-3 mb-1.5 text-[11px] font-semibold text-tertiary uppercase tracking-wider">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-primary/10 text-primary nav-active"
                        : "text-sidebar-foreground hover:bg-hover hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 flex-shrink-0 transition-colors", isActive ? "text-primary" : "text-sidebar-foreground")} />
                    <span className="flex-1">{item.name}</span>
                    {item.badge === 'signoffs' && <SignoffCountBadge />}
                    {item.badge === 'pendingTeachers' && <PendingTeachersBadge />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-hover transition-colors text-left">
              <InitialsAvatar name={displayName} src={profile?.avatar_url} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                <p className="text-xs text-tertiary truncate">{roleLabel}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-tertiary flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <TestModeMenuItems />
            <ThemeToggle />
            {userType === 'student' && profile?.handle && (
              <DropdownMenuItem asChild>
                <a href={`/@${profile.handle}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  My profile
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link to={createPageUrl('Profile')} className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                Profile & Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}