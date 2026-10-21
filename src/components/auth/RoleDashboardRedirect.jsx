import React, { useEffect } from 'react';
import { useSchool } from '@/lib/SchoolContext';
import AppLoadingGate from '@/components/auth/AppLoadingGate';
import { guardedRedirect } from '@/lib/authRedirectGuard';
import { base44 } from '@/api/base44Client';

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
    let cancelled = false;
    (async () => {
      // Platform-level Super Admin lands in the internal console —
      // server-authorised, never inferred from user_type (P0/A01). A failed
      // probe grants nothing and ordinary routing continues.
      // Probed for EVERY role — a platform administrator's personal account
      // may be a holder (user_type 'student'). Server-authorised; a failed
      // probe grants nothing and ordinary routing continues.
      try {
        const res = await base44.functions.invoke('getInternalAdminStatus');
        if (res?.data?.is_internal_admin && !cancelled) {
          guardedRedirect('/internal/admin');
          return;
        }
      } catch { /* probe failed — ordinary routing, no privilege assumed */ }
      if (!cancelled) {
        // Through the redirect guard: counted for loop detection, and a
        // same-path target is a no-op instead of an endless self-reload.
        guardedRedirect(DASHBOARD_MAP[effectiveRole] || (user ? '/Login' : '/'));
      }
    })();
    return () => { cancelled = true; };
  }, [loading, effectiveRole, user]);

  return <AppLoadingGate message="Taking you to your dashboard…" />;
}