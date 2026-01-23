import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { 
  LayoutDashboard, Users, BookOpen, Calendar, Award, 
  FileText, Settings, LogOut, Menu, X, ChevronDown,
  GraduationCap, Shield, UserCircle, Bell, Search, BarChart3
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export default function Layout({ children, currentPageName }) {
  const authContext = useAuth();
  const { user, profile, loading, logout } = authContext || {};
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Public pages that don't need sidebar
  const publicPages = ['Home', 'Login'];
  const isPublicPage = publicPages.includes(currentPageName);

  // Handle case where AuthProvider might not be available
  if (!authContext && !isPublicPage) {
    return <div>{children}</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/30">
            <div className="animate-pulse">
              <Shield className="h-8 w-8 text-white" />
            </div>
          </div>
          <div className="h-1 w-32 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full animate-[shimmer_1s_ease-in-out_infinite]" />
          </div>
          <p className="text-slate-600 text-sm font-medium">Loading BlockWard...</p>
        </div>
      </div>
    );
  }

  if (isPublicPage || !user) {
    return (
      <div className="min-h-screen bg-slate-50">
        {children}
      </div>
    );
  }

  const userType = profile?.user_type || 'student';

  const navigationItems = {
    admin: [
      { name: 'Dashboard', icon: LayoutDashboard, page: 'AdminDashboard' },
      { name: 'Users', icon: Users, page: 'ManageUsers' },
      { name: 'Classes', icon: BookOpen, page: 'Classes' },
      { name: 'Timetable', icon: Calendar, page: 'Timetable' },
      { name: 'Attendance', icon: UserCircle, page: 'Attendance' },
      { name: 'Grade Book', icon: BookOpen, page: 'GradeBook' },
      { name: 'Messages', icon: Bell, page: 'Messages' },
      { name: 'Resources', icon: FileText, page: 'Resources' },
      { name: 'BlockWards', icon: Award, page: 'BlockWards' },
      { name: 'Web3 NFTs', icon: Shield, page: 'Web3BlockWards' },
      { name: 'Point Categories', icon: Settings, page: 'PointCategories' },
      { name: 'Analytics', icon: BarChart3, page: 'Analytics' },
      { name: 'Reports', icon: FileText, page: 'Reports' },
      { name: 'School Codes', icon: Shield, page: 'SchoolCodes' },
      { name: 'Parent Comms', icon: Bell, page: 'ParentComms' },
      { name: 'Admin Permissions', icon: Shield, page: 'AdminPermissions', superAdminOnly: true },
      { name: 'System Settings', icon: Settings, page: 'SystemSettings', superAdminOnly: true },
    ],
    teacher: [
      { name: 'Dashboard', icon: LayoutDashboard, page: 'TeacherDashboard' },
      { name: 'My Classes', icon: BookOpen, page: 'Classes' },
      { name: 'Messages', icon: FileText, page: 'Messages' },
      { name: 'Timetable', icon: Calendar, page: 'Timetable' },
      { name: 'Issue Points', icon: Award, page: 'IssuePoints' },
      { name: 'Parent Comms', icon: FileText, page: 'ParentComms' },
      { name: 'BlockWards', icon: Shield, page: 'TeacherBlockWards' },
      { name: 'Resources', icon: FileText, page: 'Resources' },
    ],
    student: [
      { name: 'Dashboard', icon: LayoutDashboard, page: 'StudentDashboard' },
      { name: 'My Classes', icon: BookOpen, page: 'Classes' },
      { name: 'Messages', icon: FileText, page: 'Messages' },
      { name: 'Timetable', icon: Calendar, page: 'Timetable' },
      { name: 'My Points', icon: Award, page: 'MyPoints' },
      { name: 'My BlockWards', icon: Shield, page: 'StudentBlockWards' },
      { name: 'Resources', icon: FileText, page: 'Resources' },
    ],
  };

  let navItems = navigationItems[userType] || navigationItems.student;

  // Filter admin nav items based on permissions
  if (userType === 'admin' && profile) {
    navItems = navItems.filter(item => {
      // Super admin only items
      if (item.superAdminOnly) {
        return profile.admin_level === 'super_admin' || !profile.admin_level;
      }
      // Permission-based items
      if (item.permission) {
        // If no admin_level set, grant all access (backward compatibility)
        if (!profile.admin_level) return true;
        // Super admins have all permissions
        if (profile.admin_level === 'super_admin') return true;
        // Check specific permission
        return profile.admin_permissions?.[item.permission] === true;
      }
      return true;
    });
  }

  const roleColors = {
    admin: 'from-rose-500 to-orange-500',
    teacher: 'from-violet-500 to-purple-500',
    student: 'from-blue-500 to-cyan-500'
  };

  const roleLabels = {
    admin: 'Administrator',
    teacher: 'Teacher',
    student: 'Student'
  };

  return (
      <div className="min-h-screen bg-slate-50">
      {/* Testnet Badge */}
      <div className="fixed top-4 right-4 z-50 bg-amber-100 text-amber-900 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg border border-amber-200">
        Testnet Mode: Polygon Amoy
      </div>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-lg border-b border-slate-200 z-50 px-4 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors duration-200 active:scale-95">
          <Menu className="h-5 w-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${roleColors[userType]} flex items-center justify-center`}>
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-slate-900">BlockWard</span>
        </div>
        <div className="w-10" />
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl animate-in slide-in-from-left duration-300">
            <SidebarContent 
              navItems={navItems} 
              currentPageName={currentPageName}
              profile={profile}
              user={user}
              userType={userType}
              roleColors={roleColors}
              roleLabels={roleLabels}
              onClose={() => setSidebarOpen(false)}
              onLogout={logout}
            />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-slate-200">
          <SidebarContent 
            navItems={navItems} 
            currentPageName={currentPageName}
            profile={profile}
            user={user}
            userType={userType}
            roleColors={roleColors}
            roleLabels={roleLabels}
            onLogout={logout}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-72 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
      </div>
      );
}

function SidebarContent({ navItems, currentPageName, profile, user, userType, roleColors, roleLabels, onClose, onLogout }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
        <Link to={createPageUrl('Home')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${roleColors[userType]} flex items-center justify-center shadow-lg shadow-violet-500/25`}>
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900">BlockWard</h1>
            <p className="text-xs text-slate-500">{roleLabels[userType]}</p>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg lg:hidden">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentPageName === item.page;
          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98]",
                isActive 
                  ? `bg-gradient-to-r ${roleColors[userType]} text-white shadow-lg shadow-violet-500/25` 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-400")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-slate-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition-all duration-200 active:scale-[0.98]">
              <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${roleColors[userType]} flex items-center justify-center text-white font-semibold shadow-lg`}>
                {profile?.first_name?.[0] || user?.email?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-slate-900">
                  {profile ? `${profile.first_name} ${profile.last_name}` : user?.email}
                </p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link to={createPageUrl('Profile')} className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                Profile & Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-red-600 font-medium">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}