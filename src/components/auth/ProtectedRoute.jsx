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
      base44.auth.redirectToLogin(createPageUrl('Onboarding'));
      return;
    }

    // Authenticated but no profile and profile is required - redirect to onboarding
    if (requireProfile && !profile) {
      window.location.href = createPageUrl('Onboarding');
      return;
    }
  }, [user, profile, loading, initialized, requireProfile]);

  // Show loading state while checking auth
  if (!initialized || loading) {
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

  // Not authenticated
  if (!user) {
    return null;
  }

  // Profile required but not found
  if (requireProfile && !profile) {
    return null;
  }

  return children;
}