import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
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
      // User not authenticated
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      if (profiles.length > 0) {
        setProfile(profiles[0]);
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  const logout = () => {
    base44.auth.logout(createPageUrl('Home'));
  };

  const value = {
    user,
    profile,
    loading,
    initialized,
    isAuthenticated: !!user,
    hasProfile: !!profile,
    refreshProfile,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}