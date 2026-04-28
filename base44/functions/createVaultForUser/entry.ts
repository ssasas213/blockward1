import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { generatePrivateKey, privateKeyToAccount } from 'npm:viem@2.7.0/accounts';
import { createPublicClient, http } from 'npm:viem@2.7.0';
import { sepolia } from 'npm:viem@2.7.0/chains';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await req.json();

    if (!userId) {
      return Response.json({ error: 'userId required' }, { status: 400 });
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

    // Generate new EVM private key
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const address = account.address;

    // Encrypt private key (basic encryption - use proper encryption in production)
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(Deno.env.get('ISSUER_PRIVATE_KEY').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      keyMaterial,
      encoder.encode(privateKey)
    );

    const encryptedHex = Array.from(new Uint8Array(encrypted))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const ivHex = Array.from(iv)
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const encryptedKey = `${ivHex}:${encryptedHex}`;

    // Create vault record
    await base44.asServiceRole.entities.Vaults.create({
      user_id: userId,
      address,
      chain: 'sepolia',
      status: 'active',
      private_key_encrypted: encryptedKey
    });

    return Response.json({
      success: true,
      vaultAddress: address
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});