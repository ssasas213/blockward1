import React, { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Loader2, Shield } from 'lucide-react';

export default function ProtectedRoute({ children, requireProfile = true }) {
  const { user, profile, loading, initialized } = useAuth();

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center animate-pulse">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <p className="text-slate-500 text-sm">Loading...</p>
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