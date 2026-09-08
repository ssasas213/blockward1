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

  // ── Identity: fetched ONCE per session here ──
  // SchoolContext is the single source of truth for auth user + profile.
  // ProtectedRoute and every page consume this context — none of them should
  // call base44.auth.me() or refetch the profile themselves.
  const loadSchoolData = useCallback(async () => {
    try {
      const currentUser = await base44.auth.me();
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setUser(currentUser);

      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      let p = profiles[0] || null;

      // Test-mode probe — ONLY the test controller needs it (their profile is
      // flagged test_super_user server-side), plus the chicken-and-egg first
      // sign-in where no profile exists yet and the probe performs the
      // provisioning. Everyone else skips the call entirely.
      let testModeRes = null;
      if (!p || p.test_super_user) {
        try {
          const res = await base44.functions.invoke('getTestModeStatus');
          if (res.data?.is_test_super_user) testModeRes = res.data;
        } catch { /* test mode disabled — normal user */ }
        // Provisioning may have just created/promoted the controller profile —
        // refresh so the rest of this function uses authoritative server state.
        if (testModeRes) {
          const refreshed = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
          if (refreshed.length > 0) { p = refreshed[0]; }
        }
      }

      if (!p && !testModeRes) {
        setTestMode({ isTestSuperUser: false });
        setLoading(false);
        return;
      }
      setProfile(p);

      if (testModeRes) {
        const personas = testModeRes.personas || {};
        const activePersona = testModeRes.active_persona || 'admin';
        const activeInfo = personas[activePersona] || {};
        setTestMode({
          isTestSuperUser: true,
          activePersona,
          testSchool: testModeRes.test_school,
          testClass: testModeRes.test_class,
          personas,
          effectiveEmail: activeInfo.email,
          effectiveId: activeInfo.id,
          effectiveName: activeInfo.name,
          profileId: testModeRes.profile_id,
        });
      } else {
        setTestMode({ isTestSuperUser: false });
      }

      if (p.user_type === 'admin') {
        const [ownedSchools, memberships] = await Promise.all([
          base44.entities.School.filter({ admin_email: currentUser.email }),
          base44.entities.AdminSchoolMembership.filter({ admin_email: currentUser.email, status: 'active' }),
        ]);

        const ownedIds = new Set(ownedSchools.map(s => s.id));
        const memberSchoolIds = memberships.map(m => m.school_id).filter(id => !ownedIds.has(id));
        const activeSchoolId = p.active_school_id || p.school_id;

        // Member schools and the active school are independent of each other —
        // fetch them concurrently, never one awaited query per school in a loop.
        const [memberSchoolLists, activeSchoolLists] = await Promise.all([
          Promise.all(memberSchoolIds.map(sid =>
            base44.entities.School.filter({ id: sid }).catch(() => [])
          )),
          activeSchoolId
            ? base44.entities.School.filter({ id: activeSchoolId }).catch(() => [])
            : Promise.resolve([]),
        ]);
        const memberSchools = memberSchoolLists.map(l => l[0]).filter(Boolean);
        setManagedSchools([...ownedSchools, ...memberSchools]);
        if (activeSchoolLists.length > 0) setActiveSchool(activeSchoolLists[0]);
      } else {
        // Teachers and students — single school, no switcher
        if (p.school_id) {
          const schools = await base44.entities.School.filter({ id: p.school_id });
          if (schools.length > 0) setActiveSchool(schools[0]);
        } else if (p.user_type === 'teacher') {
          // Teachers may have an active StaffMembership without school_id on profile yet —
          // provisioned server-side (school_id is a membership field, not client-writable).
          try {
            const res = await base44.functions.invoke('activateTeacherSchool');
            const data = res.data || res;
            const sid = data?.school_id;
            if (!data?.error && sid) {
              const schools = await base44.entities.School.filter({ id: sid });
              if (schools.length > 0) setActiveSchool(schools[0]);
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
    // school_id / active_school_id are membership fields — updated server-side only.
    const res = await base44.functions.invoke('switchActiveSchool', { school_id: schoolId });
    const data = res.data || res;
    if (data?.error) throw new Error(data.error);
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