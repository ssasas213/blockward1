import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Loader2, Shield } from 'lucide-react';

export default function ProtectedRoute({ children, requireProfile = true }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser) {
        const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
        if (profiles.length > 0) {
          setProfile(profiles[0]);
        }
      }
    } catch (error) {
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  useEffect(() => {
    if (!initialized || loading) return;

    // Not authenticated - redirect to login
    if (!user) {
      window.location.href = '/Login';
      return;
    }

    // Authenticated but no profile - redirect to onboarding
    if (requireProfile && !profile) {
      window.location.href = createPageUrl('Onboarding');
      return;
    }

    // Admin with no school linked — redirect to school setup
    if (requireProfile && profile && profile.user_type === 'admin' && !profile.school_id) {
      window.location.href = createPageUrl('SchoolSetup');
      return;
    }

    // Teacher with no school linked — redirect to join school page
    if (requireProfile && profile && profile.user_type === 'teacher' && !profile.school_id) {
      window.location.href = createPageUrl('JoinSchool');
      return;
    }

    // Profile pending approval - redirect to login (shows pending message)
    if (requireProfile && profile && profile.status === 'pending_approval') {
      window.location.href = '/Login';
      return;
    }

    // Profile suspended - redirect to login (shows suspended message)
    if (requireProfile && profile && (profile.status === 'suspended' || profile.status === 'inactive')) {
      window.location.href = '/Login';
      return;
    }
  }, [user, profile, loading, initialized, requireProfile]);

  // Show loading state while checking auth
  if (!initialized || loading) {
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

  // Not authenticated
  if (!user) {
    return null;
  }

  // Profile required but not found
  if (requireProfile && !profile) {
    return null;
  }

  // Admin with no school — redirect in progress
  if (requireProfile && profile && profile.user_type === 'admin' && !profile.school_id) {
    return null;
  }

  // Teacher with no school — redirect in progress
  if (requireProfile && profile && profile.user_type === 'teacher' && !profile.school_id) {
    return null;
  }

  // Pending or suspended — redirect in progress
  if (requireProfile && profile && (
    profile.status === 'pending_approval' ||
    profile.status === 'suspended' ||
    profile.status === 'inactive'
  )) {
    return null;
  }

  return children;
}