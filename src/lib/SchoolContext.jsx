import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const SchoolContext = createContext(null);

export const SchoolProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeSchool, setActiveSchool] = useState(null);
  const [managedSchools, setManagedSchools] = useState([]);
  const [testMode, setTestMode] = useState(null);
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
        setTestMode({ isTestSuperUser: false });
        setLoading(false);
        return;
      }

      let p = profiles[0];
      setProfile(p);

      // Test Super User — server-authorised. Ensures the test environment exists
      // and returns the active persona. Source of truth is the backend secret check,
      // NOT this profile flag (which a normal user could otherwise set on themselves).
      if (p.test_super_user) {
        try {
          const res = await base44.functions.invoke('getTestModeStatus');
          if (res.data?.is_test_super_user) {
            const personas = res.data.personas || {};
            const activePersona = res.data.active_persona || 'admin';
            const activeInfo = personas[activePersona] || {};
            setTestMode({
              isTestSuperUser: true,
              activePersona,
              testSchool: res.data.test_school,
              testClass: res.data.test_class,
              personas,
              effectiveEmail: activeInfo.email,
              effectiveId: activeInfo.id,
              effectiveName: activeInfo.name,
              profileId: res.data.profile_id,
            });
            // The function may have just set school_id — refresh the local profile copy
            if (!p.school_id || !p.active_school_id) {
              const refreshed = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
              if (refreshed.length > 0) { p = refreshed[0]; setProfile(p); }
            }
          } else {
            setTestMode({ isTestSuperUser: false });
          }
        } catch {
          setTestMode({ isTestSuperUser: false });
        }
      } else {
        setTestMode({ isTestSuperUser: false });
      }

      if (p.user_type === 'admin') {
        // Load owned schools + schools from active memberships
        const [ownedSchools, memberships] = await Promise.all([
          base44.entities.School.filter({ admin_email: currentUser.email }),
          base44.entities.AdminSchoolMembership.filter({ admin_email: currentUser.email, status: 'active' }),
        ]);

        // Fetch schools from memberships that aren't already in ownedSchools
        const ownedIds = new Set(ownedSchools.map(s => s.id));
        const memberSchoolIds = memberships.map(m => m.school_id).filter(id => !ownedIds.has(id));
        const memberSchools = [];
        for (const sid of memberSchoolIds) {
          try {
            const s = await base44.entities.School.filter({ id: sid });
            if (s.length > 0) memberSchools.push(s[0]);
          } catch { /* skip */ }
        }

        const allSchools = [...ownedSchools, ...memberSchools];
        setManagedSchools(allSchools);

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
        } else if (p.user_type === 'teacher') {
          // Teachers may have an active StaffMembership without school_id on profile yet
          try {
            const staff = await base44.entities.StaffMembership.filter({ user_email: currentUser.email });
            const active = staff.find(s => s.status === 'active');
            if (active) {
              const schools = await base44.entities.School.filter({ id: active.school_id });
              if (schools.length > 0) {
                setActiveSchool(schools[0]);
                // Also update profile.school_id so RLS works
                await base44.entities.UserProfile.update(p.id, {
                  school_id: active.school_id,
                  active_school_id: active.school_id,
                  admin_email: schools[0].admin_email,
                });
              }
            }
          } catch { /* skip */ }
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
    // Background refresh — don't set loading=true (that would show full-page spinner in Layout)
    loadSchoolData();
  }, [loadSchoolData]);

  const setTestPersona = useCallback(async (persona) => {
    await base44.functions.invoke('setTestPersona', { persona });
    await loadSchoolData();
  }, [loadSchoolData]);

  const resetTestData = useCallback(async () => {
    await base44.functions.invoke('resetTestData', { confirm: true });
    await loadSchoolData();
  }, [loadSchoolData]);

  const isAdmin = profile?.user_type === 'admin';

  // ── Effective persona ──
  // In Test Mode, the effective role/profile/email is the active test persona's;
  // for normal users it is their real profile. This is the single value role-dependent
  // UI should consult so the interface matches what a real user of that role sees.
  const isTestMode = !!testMode?.isTestSuperUser;
  const effectiveRole = isTestMode ? testMode.activePersona : profile?.user_type;
  const effectiveEmail = isTestMode && testMode.effectiveEmail ? testMode.effectiveEmail : user?.email;
  const effectiveId = isTestMode && testMode.effectiveId ? testMode.effectiveId : profile?.id;
  const effectiveName = isTestMode && testMode.effectiveName ? testMode.effectiveName
    : (profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : null);
  const activePersonaInfo = isTestMode ? (testMode.personas?.[testMode.activePersona] || {}) : null;
  const effectiveProfile = isTestMode ? {
    id: testMode.effectiveId,
    user_email: testMode.effectiveEmail,
    user_type: testMode.activePersona,
    first_name: activePersonaInfo?.first_name || '',
    last_name: activePersonaInfo?.last_name || '',
    school_id: testMode.testSchool?.id,
    status: 'active',
  } : profile;
  const effectiveUser = isTestMode ? { email: effectiveEmail, id: user?.id } : user;

  // Any authenticated user without an active school is "unlinked" — the route guard
  // redirects them to the join flow, so the app never renders in a half-state.
  const hasNoSchool = !!profile && !activeSchool && !loading;

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
    testMode,
    setTestPersona,
    resetTestData,
    // Effective persona values — use these for role-dependent UI.
    isTestMode,
    effectiveRole,
    effectiveEmail,
    effectiveId,
    effectiveName,
    effectiveProfile,
    effectiveUser,
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