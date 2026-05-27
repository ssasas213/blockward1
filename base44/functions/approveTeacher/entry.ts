import { createPublicClient, createWalletClient, http, parseAbi } from "npm:viem@2.7.0";
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";
import { sepolia } from "npm:viem@2.7.0/chains";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  const debugId = `AT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const log = (msg, obj = {}) => console.log(JSON.stringify({ msg, debugId, ...obj }));

  try {
    log("=== APPROVE TEACHER START ===", { method: req.method });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (req.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'Method not allowed', debugId }), { status: 405, headers: corsHeaders });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return new Response(JSON.stringify({ ok: false, error: 'Unauthorized', debugId }), { status: 401, headers: corsHeaders });
    if (user.role !== 'admin') return new Response(JSON.stringify({ ok: false, error: 'Forbidden: admin role required', debugId }), { status: 403, headers: corsHeaders });

    log("Admin authenticated", { email: user.email });

    const body = await req.json();
    const { teacherAddress } = body;

    if (!teacherAddress || !/^0x[a-fA-F0-9]{40}$/.test(teacherAddress)) {
      return new Response(JSON.stringify({ ok: false, code: 'INVALID_ADDRESS', error: 'Invalid teacherAddress format', debugId }), { status: 400, headers: corsHeaders });
    }

    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    const contractAddress = Deno.env.get("CONTRACT_ADDRESS");
    const adminPrivateKey = Deno.env.get("ADMIN_PRIVATE_KEY");

    if (!rpcUrl) return new Response(JSON.stringify({ ok: false, error: 'SEPOLIA_RPC_URL not configured', debugId }), { status: 500, headers: corsHeaders });
    if (!contractAddress) return new Response(JSON.stringify({ ok: false, error: 'CONTRACT_ADDRESS not configured', debugId }), { status: 500, headers: corsHeaders });
    if (!adminPrivateKey) return new Response(JSON.stringify({ ok: false, error: 'ADMIN_PRIVATE_KEY not configured', debugId }), { status: 500, headers: corsHeaders });

    if (!/^0x[a-fA-F0-9]{64}$/.test(adminPrivateKey)) {
      return new Response(JSON.stringify({ ok: false, code: 'INVALID_ADMIN_PRIVATE_KEY', message: 'ADMIN_PRIVATE_KEY must be 0x + 64 hex chars', debugId }), { status: 500, headers: corsHeaders });
    }

    const account = privateKeyToAccount(adminPrivateKey);
    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
    const adminSigner = account.address;
    log("adminSigner", { adminSigner, teacherAddress });

    let simulationResult;
    try {
      simulationResult = await publicClient.simulateContract({
        account,
        address: contractAddress,
        abi: parseAbi(["function addTeacher(address teacher)"]),
        functionName: 'addTeacher',
        args: [teacherAddress],
      });
      log("addTeacher simulation passed");
    } catch (e) {
      log("addTeacher simulation failed", { error: e?.message });
      return new Response(JSON.stringify({
        ok: false, code: 'SIMULATION_FAILED',
        message: `addTeacher simulation failed: ${e?.message}`,
        debugId, contractAddress, adminSigner, teacherAddress
      }), { status: 200, headers: corsHeaders });
    }

    const txHash = await walletClient.writeContract(simulationResult.request);
    log("Transaction sent", { txHash });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    log("Transaction confirmed", { txHash: receipt.transactionHash, status: receipt.status, blockNumber: receipt.blockNumber.toString() });

    if (receipt.status !== 'success') {
      return new Response(JSON.stringify({ ok: false, code: 'TX_REVERTED', error: 'Transaction reverted', txHash: receipt.transactionHash, debugId }), { status: 200, headers: corsHeaders });
    }

    // Post-check
    const postCheck = { accessControl: {}, mappingChecks: {} };

    try {
      const teacherRole = await publicClient.readContract({ address: contractAddress, abi: parseAbi(["function TEACHER_ROLE() view returns (bytes32)"]), functionName: 'TEACHER_ROLE' });
      postCheck.accessControl.hasTeacherRole = await publicClient.readContract({ address: contractAddress, abi: parseAbi(["function hasRole(bytes32 role, address account) view returns (bool)"]), functionName: 'hasRole', args: [teacherRole, teacherAddress] });
    } catch { postCheck.accessControl.hasTeacherRole = null; }

    try {
      const platformRole = await publicClient.readContract({ address: contractAddress, abi: parseAbi(["function PLATFORM_ROLE() view returns (bytes32)"]), functionName: 'PLATFORM_ROLE' });
      postCheck.accessControl.hasPlatformRole = await publicClient.readContract({ address: contractAddress, abi: parseAbi(["function hasRole(bytes32 role, address account) view returns (bool)"]), functionName: 'hasRole', args: [platformRole, teacherAddress] });
    } catch { postCheck.accessControl.hasPlatformRole = null; }

    for (const method of ['isTeacher', 'isApprovedTeacher', 'approvedTeachers', 'teachers']) {
      try {
        postCheck.mappingChecks[method] = await publicClient.readContract({ address: contractAddress, abi: parseAbi([`function ${method}(address) view returns (bool)`]), functionName: method, args: [teacherAddress] });
      } catch { postCheck.mappingChecks[method] = null; }
    }

    log("=== APPROVE TEACHER SUCCESS ===");
    return new Response(JSON.stringify({ ok: true, debugId, txHash: receipt.transactionHash, adminSigner, teacherAddress, receiptStatus: receipt.status, blockNumber: receipt.blockNumber.toString(), postCheck }), { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error("APPROVE_TEACHER_ERROR", JSON.stringify({ debugId, error: err?.message, code: err?.code }));
    return new Response(JSON.stringify({ ok: false, error: err?.message || "Unknown error", debugId }), { status: 500, headers: corsHeaders });
  }
});