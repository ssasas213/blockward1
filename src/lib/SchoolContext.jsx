import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const SchoolContext = createContext(null);

export const SchoolProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeSchool, setActiveSchool] = useState(null);
  const [managedSchools, setManagedSchools] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSchoolData = useCallback(async () => {
    try {
      const currentUser = await base44.auth.me();
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setUser(currentUser);

      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      if (profiles.length === 0) {
        setLoading(false);
        return;
      }

      const p = profiles[0];
      setProfile(p);

      if (p.user_type === 'admin') {
        // Load all schools where this admin is the owner
        const ownedSchools = await base44.entities.School.filter({ admin_email: currentUser.email });
        setManagedSchools(ownedSchools);

        // Load the active school (from school_id or active_school_id)
        const schoolId = p.active_school_id || p.school_id;
        if (schoolId) {
          const schools = await base44.entities.School.filter({ id: schoolId });
          if (schools.length > 0) setActiveSchool(schools[0]);
        }
      } else {
        // Teachers and students — single school, no switcher
        if (p.school_id) {
          const schools = await base44.entities.School.filter({ id: p.school_id });
          if (schools.length > 0) setActiveSchool(schools[0]);
        }
      }
    } catch (error) {
      console.error('Error loading school data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchoolData();
  }, [loadSchoolData]);

  const switchSchool = useCallback(async (schoolId) => {
    if (!profile) return;
    // Update both school_id (used by RLS) and active_school_id (explicit)
    await base44.entities.UserProfile.update(profile.id, {
      school_id: schoolId,
      active_school_id: schoolId,
    });
    // Full reload ensures every page re-fetches data scoped to the new school
    window.location.reload();
  }, [profile]);

  const refresh = useCallback(() => {
    setLoading(true);
    loadSchoolData();
  }, [loadSchoolData]);

  const isAdmin = profile?.user_type === 'admin';
  const hasNoSchool = isAdmin && !activeSchool && !loading;

  const value = {
    user,
    profile,
    activeSchool,
    managedSchools,
    loading,
    isAdmin,
    hasNoSchool,
    switchSchool,
    refresh,
    loadSchoolData,
  };

  return (
    <SchoolContext.Provider value={value}>
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error('useSchool must be used within SchoolProvider');
  return ctx;
};