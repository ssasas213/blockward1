import { generatePrivateKey, privateKeyToAccount } from 'npm:viem@2.7.0/accounts';

/**
 * ensureVault — creates a custodial vault for a user if they don't already
 * have one. Shared by createVaultForUser (self-service) and joinClassByCode
 * (auto-provision on first class join). Admins never receive personal vaults.
 *
 * Returns the vault address (existing or newly created), or null if the user
 * is an admin / has no profile / no userId.
 */
export async function ensureVault(svc: any, userId: string | undefined, profile: any): Promise<string | null> {
  if (!userId || !profile) return null;
  if (profile.user_type === 'admin') return null;

  const existing = await svc.entities.Vaults.filter({ user_id: userId }).catch(() => []);
  if (existing.length > 0) return existing[0].address;

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const address = account.address;

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode((Deno.env.get('ISSUER_PRIVATE_KEY') || '').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    encoder.encode(privateKey),
  );
  const encryptedHex = Array.from(new Uint8Array(encrypted)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join('');
  const encryptedKey = `${ivHex}:${encryptedHex}`;

  await svc.entities.Vaults.create({
    user_id: userId,
    school_id: profile.school_id || null,
    address,
    chain: 'sepolia',
    status: 'active',
    private_key_encrypted: encryptedKey,
  });

  const update: any = { wallet_address: address };
  if (!profile.portfolio_public_id) {
    update.portfolio_public_id = 'prt-' + Math.random().toString(36).substring(2, 10);
  }
  await svc.entities.UserProfile.update(profile.id, update);

  return address;
}