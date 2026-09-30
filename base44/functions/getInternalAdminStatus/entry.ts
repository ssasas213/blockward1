// getInternalAdminStatus — returns whether the authenticated caller is a
// Blockward internal admin. Frontend UX gating only; every privileged action
// is re-authorized server-side. Exposes no secrets.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isInternalAdmin } from '../../shared/internalAdmin.ts';
import { isTestModeEnabled, getTestSuperUserEmail } from '../../shared/testMode.ts';

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    const email = String(me?.email || '').trim().toLowerCase();
    const testSuperOk = isTestModeEnabled() && email === getTestSuperUserEmail().toLowerCase();
    const isAdmin = isInternalAdmin(email) || testSuperOk;
    return Response.json({ is_internal_admin: !!isAdmin, email: me?.email || null });
  } catch {
    return Response.json({ is_internal_admin: false }, { status: 200 });
  }
}