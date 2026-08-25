import React, { useEffect, useState } from 'react';
import { createPageUrl } from '@/utils';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useSchool } from '@/lib/SchoolContext';
import { Loader2 } from 'lucide-react';

// Route-level role gate. Wrap any role-specific page's default export:
//   <RoleGuard roles={['teacher']}><Page/></RoleGuard>
// It runs ProtectedRoute first (auth + profile + onboarding/school-link
// redirects), then checks the caller's EFFECTIVE role (the active Test Mode
// persona for the test super user, otherwise UserProfile.user_type) against the
// allowed roles. On mismatch it redirects to the caller's own dashboard instead
// of rendering the page — never relying on hiding buttons inside it.
//
// RLS `user_condition` can only check the platform role, so role-gating by
// UserProfile.user_type is enforced here, at the route layer, in one place.

const DASHBOARD_PAGE = {
  admin: 'AdminDashboard',
  teacher: 'TeacherDashboard',
  student: 'StudentDashboard',
};

export default function RoleGuard({ roles, children }) {
  return (
    <ProtectedRoute>
      <RoleCheck roles={roles}>{children}</RoleCheck>
    </ProtectedRoute>
  );
}

function RoleCheck({ roles, children }) {
  const { profile, testMode, loading } = useSchool();
  const [redirecting, setRedirecting] = useState(false);

  const isTestSuperUser = !!testMode?.isTestSuperUser;
  const effectiveRole = profile
    ? (isTestSuperUser ? (testMode.activePersona || 'admin') : profile.user_type)
    : null;

  useEffect(() => {
    if (loading || !effectiveRole) return;
    if (!roles.includes(effectiveRole)) {
      setRedirecting(true);
      window.location.href = createPageUrl(DASHBOARD_PAGE[effectiveRole] || 'StudentDashboard');
    }
  }, [loading, effectiveRole, roles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!effectiveRole || !roles.includes(effectiveRole) || redirecting) return null;
  return children;
}