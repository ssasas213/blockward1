import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ALL_ROUTES = [
  '/AdminRecords',
  '/TeacherRecords',
  '/StudentMyRecords',
  '/RecordDetail',
  '/AdminDashboard',
  '/TeacherDashboard',
  '/StudentDashboard',
  '/Classes',
  '/BlockWards',
  '/TeacherBlockWards',
  '/StudentBlockWards',
  '/IssuePoints',
  '/BlockWardAI',
  '/Announcements',
  '/Messages',
  '/Profile',
  '/Timetable',
  '/SchoolEvents',
  '/ManageUsers',
  '/SchoolCodes',
  '/Analytics',
  '/Reports',
  '/Resources',
  '/PointCategories',
  '/GradeBook',
  '/Attendance',
  '/ParentComms',
  '/SystemSettings',
  '/AdminPermissions',
];

export default function RouteDebug() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        const profiles = await base44.entities.UserProfile.filter({ user_email: u.email });
        setProfile(profiles[0] || null);
      } catch (e) {
        // not logged in
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-8 text-slate-500">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Route Debug</h1>

      {/* Current User Profile */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-base">Current User</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {user ? (
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-slate-500">Email:</span> <span className="font-medium">{user.email}</span></div>
              <div><span className="text-slate-500">user_type:</span> <Badge className={profile?.user_type === 'admin' ? 'bg-rose-100 text-rose-700' : profile?.user_type === 'teacher' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}>{profile?.user_type || 'NO PROFILE'}</Badge></div>
              <div><span className="text-slate-500">school_id:</span> <span className="font-mono text-xs">{profile?.school_id || '—'}</span></div>
              <div><span className="text-slate-500">status:</span> <Badge className={profile?.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{profile?.status || '—'}</Badge></div>
              <div><span className="text-slate-500">first_name:</span> <span>{profile?.first_name || '—'}</span></div>
              <div><span className="text-slate-500">last_name:</span> <span>{profile?.last_name || '—'}</span></div>
              {!profile && (
                <div className="col-span-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 font-semibold">
                  ⚠️ No UserProfile found for {user.email} — sidebar will default to student nav
                </div>
              )}
            </div>
          ) : (
            <p className="text-red-600 font-semibold">Not logged in</p>
          )}
        </CardContent>
      </Card>

      {/* All Routes */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-base">All Registered Routes ({ALL_ROUTES.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_ROUTES.map(route => (
              <a
                key={route}
                href={route}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 hover:bg-violet-50 hover:text-violet-700 transition-colors text-sm font-mono"
              >
                {route}
                <span className="text-xs text-slate-400">→</span>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Record Routes */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-base">Student Records Routes</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            { label: 'Admin Records', url: '/AdminRecords', role: 'admin' },
            { label: 'Teacher Records', url: '/TeacherRecords', role: 'teacher' },
            { label: 'Student My Records', url: '/StudentMyRecords', role: 'student' },
            { label: 'Record Detail (test)', url: '/RecordDetail?id=6a2457527cb66d90d0f0650b', role: 'all' },
          ].map(r => (
            <div key={r.url} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="font-medium">{r.label}</p>
                <p className="text-xs font-mono text-slate-500">{r.url}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-slate-100 text-slate-600 text-xs">{r.role}</Badge>
                <a href={r.url} className="text-xs text-violet-600 underline hover:text-violet-800">Open →</a>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400 text-center">
        If you see this page at /route-debug, routing is working correctly.
        If /AdminRecords shows 404 on your custom domain, the web server needs to redirect all paths to index.html (SPA fallback).
      </p>
    </div>
  );
}