import { secrets } from 'base44:runtime';

export function isTestModeEnabled(): boolean {
  return secrets.get('TEST_MODE_ENABLED') === 'true';
}

export function getTestSuperUserEmail(): string {
  return (secrets.get('TEST_SUPER_USER_EMAIL') || '').trim().toLowerCase();
}

export async function verifyTestSuperUser(base44): Promise<{ authorized: boolean; status?: number; user?: any; reason?: string }> {
  const user = await base44.auth.me();
  if (!user) return { authorized: false, status: 401, reason: 'Not authenticated' };
  if (!isTestModeEnabled()) return { authorized: false, status: 403, user, reason: 'Test mode is disabled' };
  const email = (user.email || '').trim().toLowerCase();
  if (email !== getTestSuperUserEmail()) return { authorized: false, status: 403, user, reason: 'Not authorised for test mode' };
  return { authorized: true, user };
}

export const TEST_SCHOOL_NAME = 'BlockWard Test School';
export const TEST_SCHOOL_CODE = 'BWTEST';

export const PERSONAS = {
  student: { first_name: 'BlockWard Test', last_name: 'Student (TEST MODE)', label: 'Student' },
  teacher: { first_name: 'BlockWard Test', last_name: 'Teacher (TEST MODE)', label: 'Teacher' },
  admin: { first_name: 'BlockWard Test', last_name: 'Admin (TEST MODE)', label: 'Administrator' },
};

export function isValidPersona(p: string): boolean {
  return p === 'student' || p === 'teacher' || p === 'admin';
}