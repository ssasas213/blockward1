import { useSchool } from '@/lib/SchoolContext';

/**
 * useEffectiveRole — the canonical hook for role-dependent UI.
 *
 * Returns the effective persona's role/email/id/name when Test Mode is active
 * (server-authorised test super user only), otherwise the real user's values.
 *
 * Use `effectiveRole` for any UI authorization decision (showing/hiding buttons,
 * choosing which dashboard to render, etc.) so the interface matches what a real
 * user of that role would see. Normal production users always get their real role.
 */
export function useEffectiveRole() {
  const { testMode, profile, user } = useSchool();
  const isTestMode = !!testMode?.isTestSuperUser;
  return {
    isTestMode,
    effectiveRole: isTestMode ? testMode.activePersona : profile?.user_type,
    effectiveEmail: isTestMode && testMode.effectiveEmail ? testMode.effectiveEmail : user?.email,
    effectiveId: isTestMode && testMode.effectiveId ? testMode.effectiveId : profile?.id,
    effectiveName: isTestMode && testMode.effectiveName
      ? testMode.effectiveName
      : (profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : null),
  };
}