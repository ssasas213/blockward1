import { secrets } from 'base44:runtime';

export function isTestModeEnabled(): boolean {
  return secrets.get('TEST_MODE_ENABLED') === 'true';
}

export function getTestSuperUserEmail(): string {
  return (secrets.get('TEST_SUPER_USER_EMAIL') || '').trim().toLowerCase();
}

export function isValidPersona(p: string): boolean {
  return p === 'student' || p === 'teacher' || p === 'admin';
}

export const TEST_SCHOOL_NAME = 'BlockWard Test School';
export const TEST_SCHOOL_CODE = 'BWTEST';
export const TEST_CLASS_NAME = 'Test Class A';

export const PERSONA_EMAILS = {
  student: 'test.student@blockward.test',
  teacher: 'test.teacher@blockward.test',
  admin: 'test.admin@blockward.test',
};

export const PERSONA_NAMES = {
  student: { first_name: 'BlockWard Test', last_name: 'Student (TEST MODE)', label: 'Student' },
  teacher: { first_name: 'BlockWard Test', last_name: 'Teacher (TEST MODE)', label: 'Teacher' },
  admin: { first_name: 'BlockWard Test', last_name: 'Admin (TEST MODE)', label: 'Administrator' },
};

/**
 * verifyTestSuperUser — used by test-only management endpoints (getTestModeStatus,
 * setTestPersona, resetTestData, createTestRecord). Returns the authenticated
 * controller user only if the email matches the TEST_SUPER_USER_EMAIL secret AND
 * test mode is enabled. Normal users always get authorized=false.
 */
export async function verifyTestSuperUser(base44): Promise<{ authorized: boolean; status?: number; user?: any; reason?: string }> {
  const user = await base44.auth.me();
  if (!user) return { authorized: false, status: 401, reason: 'Not authenticated' };
  if (!isTestModeEnabled()) return { authorized: false, status: 403, user, reason: 'Test mode is disabled' };
  const email = (user.email || '').trim().toLowerCase();
  if (email !== getTestSuperUserEmail()) return { authorized: false, status: 403, user, reason: 'Not authorised for test mode' };
  return { authorized: true, user };
}

/**
 * resolveEffectiveActor — the canonical persona resolver used by every workflow
 * function (recordWorkflow, sendToStudentVault, …).
 *
 * Normal user  → effective actor = the authenticated user's real profile.
 * Test Super User → effective actor = the active test persona profile (distinct
 *   id, email, name and role), so workflow authorization follows the selected
 *   persona, NOT the controller's admin role. The active persona is read from
 *   the controller's profile server-side — never trusted from frontend input.
 *
 * Returns a flat actor object the caller maps onto its existing `user`/`profile`
 * variables, so no state-machine logic needs to change.
 */
export async function resolveEffectiveActor(base44): Promise<any> {
  const user = await base44.auth.me();
  if (!user) return { authorized: false, status: 401, reason: 'Not authenticated' };

  const svc = base44.asServiceRole;
  const profiles = await svc.entities.UserProfile.filter({ user_email: user.email });
  const controller = profiles[0];
  if (!controller) return { authorized: false, status: 403, reason: 'User profile not found' };

  // Test Mode — server-authorised by secret, not by a client-settable flag.
  if (isTestModeEnabled() && controller.test_super_user && (user.email || '').trim().toLowerCase() === getTestSuperUserEmail()) {
    const personaKey = isValidPersona(controller.active_test_persona) ? controller.active_test_persona : 'admin';
    const personaId = controller.test_persona_ids && controller.test_persona_ids[personaKey];
    if (personaId) {
      try {
        const found = await svc.entities.UserProfile.filter({ id: personaId });
        const persona = found && found[0];
        if (persona) {
          if (persona.status === 'inactive' || persona.status === 'suspended') {
            return { authorized: false, status: 403, reason: 'Your account is inactive. Contact your administrator.' };
          }
          return {
            authorized: true,
            is_test_mode: true,
            actor_id: persona.id,
            actor_email: persona.user_email,
            actor_role: persona.user_type,
            school_id: persona.school_id || controller.school_id,
            first_name: persona.first_name,
            last_name: persona.last_name,
            controller_user_id: user.id,
            controller_email: user.email,
          };
        }
      } catch { /* fall through to controller */ }
    }
  }

  // Normal user (or test controller with no persona resolved yet)
  if (controller.status === 'inactive' || controller.status === 'suspended') {
    return { authorized: false, status: 403, reason: 'Your account is inactive. Contact your administrator.' };
  }
  return {
    authorized: true,
    is_test_mode: false,
    actor_id: controller.id,
    actor_email: user.email,
    actor_role: controller.user_type,
    school_id: controller.school_id,
    first_name: controller.first_name,
    last_name: controller.last_name,
    controller_user_id: user.id,
    controller_email: user.email,
  };
}