/**
 * createVaultForUser — Creates a custodial blockchain wallet (vault) for a user.
 *
 * IMPORTANT: Admins do NOT get personal vaults. Their role is only to review,
 * authorize, and send approved BlockWards to the student's vault. Only students
 * (and teachers who can issue BlockWards) get vaults.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { ensureVault } from '../../shared/vault.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { userId } = await req.json();
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });

    // Fetch the target user's profile to check their role.
    // UserProfile has no user_id field, so for self-service (caller creating their own
    // vault) fall back to a lookup by the caller's email.
    const targetProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: userId });
    let targetProfile = targetProfiles[0];
    if (!targetProfile && userId === user.id) {
      const byEmail = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
      targetProfile = byEmail[0];
    }

    // Admins do NOT get personal vaults
    if (targetProfile?.user_type === 'admin') {
      return Response.json({
        success: false,
        error: 'Administrators do not receive personal vaults. Their role is to review and authorize achievements only.'
      }, { status: 403 });
    }

    // Check if vault already exists
    const existingVaults = await base44.asServiceRole.entities.Vaults.filter({ user_id: userId });
    if (existingVaults.length > 0) {
      return Response.json({
        success: true,
        vaultAddress: existingVaults[0].address,
        message: 'Vault already exists'
      });
    }

    const address = await ensureVault(base44.asServiceRole, userId, targetProfile);
    return Response.json({ success: true, vaultAddress: address });

  } catch (error) {
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});