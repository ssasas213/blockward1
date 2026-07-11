import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getPlatformConfig } from '@/lib/platformConfig';
import {
  LayoutDashboard, Users, Calendar, Trophy, Award, Medal,
  Star, BarChart3, Shield, Menu, X, ChevronDown, PenLine,
  HardDrive, Sparkles, UserCircle, Building2, LogOut,
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const ICON_MAP = {
  LayoutDashboard, Users, Calendar, Trophy, Award, Medal, Star,
  BarChart3, Shield, PenLine, HardDrive, UserCircle, Building2,
};

export default function OrgsLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const platform = getPlatformConfig('organisations');

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser) {
        const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
        if (profiles.length > 0) setProfile(profiles[0]);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    base44.auth.logout('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-orange-500/30">
            <div className="animate-pulse">
              <Trophy className="h-8 w-8 text-white" />
            </div>
          </div>
          <div className="h-1 w-32 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full animate-[shimmer_1s_ease-in-out_infinite]" />
          </div>
          <p className="text-slate-600 text-sm font-medium">Loading BlockWard Organisations...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.href = platform.loginPath;
    return null;
  }

  const userType = profile?.user_type || 'student';
  const navItems = platform.navigation[userType] || platform.navigation.student;
  const roleLabel = profile?.role_label || (userType === 'admin' ? 'Organisation Admin' : userType === 'teacher' ? 'Coach / Instructor' : 'Member / Athlete');

  const currentPath = location.pathname;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-lg border-b border-slate-200 z-50 px-4 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <Menu className="h-5 w-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Trophy className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-slate-900">BlockWard Orgs</span>
        </div>
        <NotificationBell userEmail={user?.email} />
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl animate-in slide-in-from-left duration-300">
            <SidebarContent
              navItems={navItems}
              currentPath={currentPath}
              platform={platform}
              profile={profile}
              user={user}
              roleLabel={roleLabel}
              onClose={() => setSidebarOpen(false)}
              onLogout={logout}
            />
          </div>
        </div>
      )}

      {/* Desktop notification bell */}
      <div className="hidden lg:flex fixed top-4 right-6 z-40">
        <NotificationBell userEmail={user?.email} />
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-slate-200">
          <SidebarContent
            navItems={navItems}
            currentPath={currentPath}
            platform={platform}
            profile={profile}
            user={user}
            roleLabel={roleLabel}
            onLogout={logout}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-72 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SidebarContent({ navItems, currentPath, platform, profile, user, roleLabel, onClose, onLogout }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900">BlockWard</h1>
            <p className="text-xs text-slate-500">{roleLabel}</p>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg lg:hidden">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto min-h-0">
        {navItems.map((item) => {
          const Icon = ICON_MAP[item.icon] || Shield;
          const isActive = currentPath === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? `bg-gradient-to-r ${platform.theme.activeGradient} text-white shadow-lg shadow-orange-500/25`
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive ? 'text-white' : 'text-slate-400')} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-slate-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition-all">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-semibold shadow-lg">
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
              <Link to="/Profile" className="flex items-center gap-2">
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