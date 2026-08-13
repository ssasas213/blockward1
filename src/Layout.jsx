import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard, Users, BookOpen, Calendar, Award,
  FileText, Settings, LogOut, Menu, X, ChevronDown,
  Shield, UserCircle, Bell, BarChart3, Sparkles, Megaphone, Trophy, HardDrive, PenLine, Search
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import SchoolSwitcher from '@/components/sidebar/SchoolSwitcher';
import ThemeToggle, { ThemeToggleCompact } from '@/components/sidebar/ThemeToggle';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import BlockWardGuide from '@/components/onboarding/BlockWardGuide';
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
  const { user, profile, activeSchool: school, loading } = useSchool();

  const publicPages = ['Home', 'Login', 'Onboarding', 'Signup', 'ChoosePlatform', 'SchoolSetup'];
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

  const userType = profile?.user_type || 'student';

  const navigationGroups = {
    admin: [
      { label: 'Overview', items: [
        { name: 'Dashboard', icon: LayoutDashboard, page: 'AdminDashboard' },
      ]},
      { label: 'Records', items: [
        { name: 'Approval Queue', icon: PenLine, page: 'AdminApprovalQueue' },
        { name: 'Achievement Records', icon: Trophy, page: 'AdminRecords' },
        { name: 'Custodian Dashboard', icon: Shield, page: 'CustodianDashboard' },
      ]},
      { label: 'Management', items: [
        { name: 'Users', icon: Users, page: 'ManageUsers' },
        { name: 'Classes', icon: BookOpen, page: 'Classes' },
        { name: 'Announcements', icon: Bell, page: 'Announcements' },
      ]},
      { label: 'Configuration', items: [
        { name: 'Point Categories', icon: Settings, page: 'PointCategories' },
        { name: 'School Settings', icon: Settings, page: 'SystemSettings' },
        { name: 'School Codes', icon: Shield, page: 'SchoolCodes' },
        { name: 'Admin Permissions', icon: Shield, page: 'AdminPermissions', superAdminOnly: true },
      ]},
      { label: 'Insights', items: [
        { name: 'Analytics', icon: BarChart3, page: 'Analytics' },
        { name: 'Reports', icon: FileText, page: 'Reports' },
      ]},
      { label: 'Tools', items: [
        { name: 'BlockWard AI', icon: Sparkles, page: 'BlockWardAI' },
        { name: 'Resources', icon: FileText, page: 'Resources' },
      ]},
    ],
    teacher: [
      { label: 'Overview', items: [
        { name: 'Dashboard', icon: LayoutDashboard, page: 'TeacherDashboard' },
      ]},
      { label: 'Achievements', items: [
        { name: 'Create Achievement', icon: Trophy, page: 'IssueBlockWard' },
        { name: 'My Submissions', icon: Shield, page: 'TeacherRecords' },
        { name: 'My BlockWards', icon: Award, page: 'TeacherBlockWards' },
      ]},
      { label: 'Teaching', items: [
        { name: 'Classes', icon: BookOpen, page: 'Classes' },
        { name: 'Timetable', icon: Calendar, page: 'Timetable' },
        { name: 'Issue Points', icon: Award, page: 'IssuePoints' },
        { name: 'Resources', icon: FileText, page: 'Resources' },
      ]},
      { label: 'Communication', items: [
        { name: 'Announcements', icon: Bell, page: 'Announcements' },
        { name: 'Messages', icon: FileText, page: 'Messages' },
        { name: 'Parent Comms', icon: FileText, page: 'ParentComms' },
      ]},
      { label: 'Tools', items: [
        { name: 'BlockWard AI', icon: Sparkles, page: 'BlockWardAI' },
      ]},
    ],
    student: [
      { label: 'Overview', items: [
        { name: 'Dashboard', icon: LayoutDashboard, page: 'StudentDashboard' },
      ]},
      { label: 'Achievements', items: [
        { name: 'My BlockWards', icon: Shield, page: 'StudentBlockWards' },
        { name: 'My Achievements', icon: Trophy, page: 'StudentMyRecords' },
        { name: 'Portfolio Vault', icon: HardDrive, page: 'StudentPortfolioVault' },
      ]},
      { label: 'School', items: [
        { name: 'My Classes', icon: BookOpen, page: 'Classes' },
        { name: 'Timetable', icon: Calendar, page: 'Timetable' },
        { name: 'My Points', icon: Award, page: 'MyPoints' },
        { name: 'Resources', icon: FileText, page: 'Resources' },
      ]},
      { label: 'Communication', items: [
        { name: 'Announcements', icon: Megaphone, page: 'Announcements' },
        { name: 'Messages', icon: FileText, page: 'Messages' },
      ]},
    ],
  };

  let groups = navigationGroups[userType] || navigationGroups.student;

  if (userType === 'admin' && profile) {
    groups = groups.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.superAdminOnly) return profile.admin_level === 'super_admin' || !profile.admin_level;
        if (item.permission) {
          if (!profile.admin_level) return true;
          if (profile.admin_level === 'super_admin') return true;
          return profile.admin_permissions?.[item.permission] === true;
        }
        return true;
      })
    })).filter(group => group.items.length > 0);
  }

  const orgType = school?.org_type || 'school';
  const orgRoleLabels = school?.settings?.role_labels;
  const roleLabel = orgRoleLabels?.[userType] || getRoleLabel(orgType, userType);
  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : user?.email;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 glass border-b border-border z-50 px-4 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-hover rounded-md transition-colors" aria-label="Open menu">
          <Menu className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground text-sm">BlockWard</span>
        </div>
        <NotificationBell userEmail={user?.email} />
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
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
          <ThemeToggleCompact />
          <div className="h-6 w-px bg-border mx-1" />
          <NotificationBell userEmail={user?.email} />
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:pl-64 lg:pt-14 pt-14 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto animate-page-in">
          {children}
        </div>
      </main>

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
          <div key={gIdx} className="mb-5">
            <p className="px-3 mb-1.5 text-[11px] font-semibold text-tertiary uppercase tracking-wider">{group.label}</p>
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
                    {item.name}
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
            <ThemeToggle />
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