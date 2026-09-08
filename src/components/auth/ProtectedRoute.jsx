import React, { useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { Shield } from 'lucide-react';
import { useSchool } from '@/lib/SchoolContext';

/**
 * ProtectedRoute — route guard with ZERO fetches of its own.
 *
 * Identity (auth user + profile) is fetched once per session by SchoolContext
 * and consumed here; this component only enforces the redirect rules. Pages
 * inside a ProtectedRoute get the same context — they should never call
 * base44.auth.me() either.
 */
export default function ProtectedRoute({ children, requireProfile = true }) {
  const { user, profile, loading } = useSchool();

  useEffect(() => {
    if (loading) return;

    // Not authenticated - redirect to login
    if (!user) {
      window.location.href = '/Login';
      return;
    }

    if (!requireProfile) return;

    // Authenticated but no profile - the new join flow starts at Signup
    if (!profile) {
      window.location.href = createPageUrl('Signup');
      return;
    }

    // Profile without a role yet — legacy signup: join or create a school
    if (profile.user_type === 'pending') {
      window.location.href = createPageUrl('JoinSchool');
      return;
    }

    // Admin with no school linked — redirect to school setup
    if (profile.user_type === 'admin' && !profile.school_id) {
      window.location.href = createPageUrl('SchoolSetup');
      return;
    }

    // Teacher with no school linked — redirect to join school page
    if (profile.user_type === 'teacher' && !profile.school_id) {
      window.location.href = createPageUrl('JoinSchool');
      return;
    }

    // Students WITHOUT a school proceed — BlockWard is fully usable without
    // an organisation, and joining one is an optional, later action.

    // Under-13 awaiting guardian consent / pending approval / suspended —
    // the login page shows the right holding message.
    if (
      profile.status === 'awaiting_guardian_consent' ||
      profile.status === 'pending_approval' ||
      profile.status === 'suspended' ||
      profile.status === 'inactive'
    ) {
      window.location.href = '/Login';
    }
  }, [user, profile, loading, requireProfile]);

  // Show loading state while the session identity loads (once per session)
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <div className="animate-pulse">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="h-1 w-32 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-primary rounded-full animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">Loading BlockWard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (requireProfile && !profile) return null;
  if (requireProfile && profile.user_type === 'pending') return null;
  if (requireProfile && profile.user_type === 'admin' && !profile.school_id) return null;
  if (requireProfile && profile.user_type === 'teacher' && !profile.school_id) return null;
  if (requireProfile && profile && (
    profile.status === 'awaiting_guardian_consent' ||
    profile.status === 'pending_approval' ||
    profile.status === 'suspended' ||
    profile.status === 'inactive'
  )) return null;

  return children;
}