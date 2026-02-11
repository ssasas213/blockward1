import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createPublicClient, http, parseAbi } from 'npm:viem@2.7.0';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';
import { sepolia } from 'npm:viem@2.7.0/chains';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const rpcUrl = Deno.env.get('SEPOLIA_RPC_URL');
    const contract = Deno.env.get('CONTRACT_ADDRESS');
    const pk = Deno.env.get('ISSUER_PRIVATE_KEY');

    const missing = {
      SEPOLIA_RPC_URL: !rpcUrl,
      CONTRACT_ADDRESS: !contract,
      ISSUER_PRIVATE_KEY: !pk,
    };

    const account = pk ? privateKeyToAccount(pk) : null;

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const chainId = await publicClient.getChainId();
    const bytecode = await publicClient.getBytecode({ address: contract });

    const abi = parseAbi([
      "function PLATFORM_ROLE() view returns (bytes32)",
      "function TEACHER_ROLE() view returns (bytes32)",
      "function hasRole(bytes32 role, address account) view returns (bool)",
    ]);

    // If contract doesn't exist, stop here
    if (!bytecode) {
      return Response.json({
        ok: false,
        missing,
        issuerAddress: account?.address,
        chainId: chainId.toString(),
        contractHasCode: false,
        message: 'Contract has no code at this address'
      });
    }

    const platformRole = await publicClient.readContract({
      address: contract,
      abi,
      functionName: "PLATFORM_ROLE",
    });

    const issuerHasPlatformRole = await publicClient.readContract({
      address: contract,
      abi,
      functionName: "hasRole",
      args: [platformRole, account.address],
    });

    // Optional: allow checking teacher role if caller sends teacherVault
    const { teacherVault } = await req.json().catch(() => ({}));
    let teacherHasRole = null;
    if (teacherVault) {
      const teacherRole = await publicClient.readContract({
        address: contract,
        abi,
        functionName: "TEACHER_ROLE",
      });
      teacherHasRole = await publicClient.readContract({
        address: contract,
        abi,
        functionName: "hasRole",
        args: [teacherRole, teacherVault],
      });
    }

    return Response.json({
      ok: true,
      missing,
      issuerAddress: account.address,
      chainId: chainId.toString(),
      chainIdExpected: '11155111',
      chainIdMatches: chainId.toString() === '11155111',
      contractAddress: contract,
      contractHasCode: true,
      issuerHasPlatformRole,
      teacherVault: teacherVault || 'not_provided',
      teacherHasRole,
      diagnosis: issuerHasPlatformRole 
        ? '✅ Issuer has PLATFORM_ROLE' 
        : '❌ Issuer does NOT have PLATFORM_ROLE - this is likely your problem'
    });

  } catch (e) {
    return Response.json({
      ok: false,
      error: String(e?.message || e),
      stack: e?.stack,
    }, { status: 500 });
  }
});