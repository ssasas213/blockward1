import React, { useEffect } from 'react';
import { useSchool } from '@/lib/SchoolContext';
import AppLoadingGate from '@/components/auth/AppLoadingGate';
import { guardedRedirect } from '@/lib/authRedirectGuard';

const DASHBOARD_MAP = {
  student: '/StudentDashboard',
  teacher: '/TeacherDashboard',
  admin: '/AdminDashboard',
};

/**
 * RoleDashboardRedirect — landing element for features hidden during beta.
 * Sends the visitor to their own role dashboard instead of showing a broken
 * or unfinished page. The feature itself is untouched and can be re-enabled
 * by restoring its original route element.
 */
export default function RoleDashboardRedirect() {
  const { effectiveRole, loading, user } = useSchool();

  useEffect(() => {
    if (loading) return;
    // Through the redirect guard: counted for loop detection, and a
    // same-path target is a no-op instead of an endless self-reload.
    guardedRedirect(DASHBOARD_MAP[effectiveRole] || (user ? '/Login' : '/'));
  }, [loading, effectiveRole, user]);

  return <AppLoadingGate message="Taking you to your dashboard…" />;
}