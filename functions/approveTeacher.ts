import { createPublicClient, createWalletClient, http, parseAbi } from "npm:viem@2.7.0";
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";
import { sepolia } from "npm:viem@2.7.0/chains";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  const debugId = `AT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const log = (msg, obj = {}) => {
    console.log(JSON.stringify({ msg, debugId, ...obj }));
  };

  try {
    log("=== APPROVE TEACHER START ===", { method: req.method });

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Method not allowed', debugId }),
        { status: 405, headers: corsHeaders }
      );
    }

    // AUTH: Require admin user via Base44 SDK
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      log("Unauthorized - not logged in");
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized', debugId }),
        { status: 401, headers: corsHeaders }
      );
    }

    if (user.role !== 'admin') {
      log("Forbidden - not admin", { email: user.email, role: user.role });
      return new Response(
        JSON.stringify({ ok: false, error: 'Forbidden: admin role required', debugId }),
        { status: 403, headers: corsHeaders }
      );
    }

    log("Admin authenticated", { email: user.email });

    // Parse body
    const body = await req.json();
    log("Request received", { teacherAddress: body.teacherAddress });

    const { teacherAddress } = body;

    if (!teacherAddress || !/^0x[a-fA-F0-9]{40}$/.test(teacherAddress)) {
      log("Invalid teacherAddress");
      return new Response(
        JSON.stringify({ 
          ok: false, 
          code: 'INVALID_ADDRESS',
          error: 'Invalid teacherAddress format', 
          debugId 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Load environment
    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    const contractAddress = Deno.env.get("CONTRACT_ADDRESS");
    const adminPrivateKey = Deno.env.get("ADMIN_PRIVATE_KEY");

    if (!rpcUrl) {
      log("SEPOLIA_RPC_URL not configured");
      return new Response(
        JSON.stringify({ ok: false, error: 'SEPOLIA_RPC_URL not configured', debugId }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!contractAddress) {
      log("CONTRACT_ADDRESS not configured");
      return new Response(
        JSON.stringify({ ok: false, error: 'CONTRACT_ADDRESS not configured', debugId }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!adminPrivateKey) {
      log("ADMIN_PRIVATE_KEY not configured");
      return new Response(
        JSON.stringify({ ok: false, error: 'ADMIN_PRIVATE_KEY not configured', debugId }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Validate ADMIN_PRIVATE_KEY format
    if (!/^0x[a-fA-F0-9]{64}$/.test(adminPrivateKey)) {
      log("ADMIN_PRIVATE_KEY invalid format", { length: adminPrivateKey?.length });
      return new Response(
        JSON.stringify({ 
          ok: false, 
          code: 'INVALID_ADMIN_PRIVATE_KEY',
          message: 'ADMIN_PRIVATE_KEY must be 0x + 64 hex chars', 
          debugId 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const rpcHost = new URL(rpcUrl).hostname;
    log("Environment loaded", { rpcHost, contractAddress });

    // Reject public RPC
    if (rpcHost === 'rpc.sepolia.org') {
      log("Public RPC detected");
      return new Response(
        JSON.stringify({ ok: false, error: 'SEPOLIA_RPC_URL must be Alchemy, not public RPC', debugId }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Setup viem clients
    log("Creating admin account...");
    const account = privateKeyToAccount(adminPrivateKey as `0x${string}`);
    
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const adminSigner = account.address;
    log("adminSigner", { adminSigner });
    log("teacherAddress", { teacherAddress });

    // Use addTeacher(address) - the correct internal approval method for this contract.
    // (grantRole grants AccessControl roles but issueAward checks a separate internal mapping)
    log("Using addTeacher(address) to approve teacher...");
    
    let simulationResult;
    let txHash;
    let receipt;

    try {
      simulationResult = await publicClient.simulateContract({
        account,
        address: contractAddress as `0x${string}`,
        abi: parseAbi(["function addTeacher(address teacher)"]),
        functionName: 'addTeacher',
        args: [teacherAddress as `0x${string}`],
      });
      log("✓ addTeacher simulation passed");
    } catch (e) {
      log("✗ addTeacher simulation failed", { error: e?.message });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'SIMULATION_FAILED',
          message: `addTeacher simulation failed: ${e?.message}`,
          debugId,
          contractAddress,
          adminSigner,
          teacherAddress
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Execute transaction
    log("Executing addTeacher transaction...");
    txHash = await walletClient.writeContract(simulationResult.request);
    log("Transaction sent", { txHash });

    // Wait for confirmation
    log("Waiting for receipt...");
    receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    
    log("Transaction confirmed", {
      txHash: receipt.transactionHash,
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString()
    });

    if (receipt.status !== 'success') {
      log("✗ Transaction reverted", { status: receipt.status });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'TX_REVERTED',
          error: 'Transaction reverted',
          txHash: receipt.transactionHash,
          receiptStatus: receipt.status,
          debugId
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // POST-CHECK: Verify approval worked
    log("Verifying approval...");
    const postCheck: any = {
      accessControl: {},
      mappingChecks: {}
    };

    // Check AccessControl roles
    try {
      const teacherRole = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: parseAbi(["function TEACHER_ROLE() view returns (bytes32)"]),
        functionName: 'TEACHER_ROLE',
      });
      const hasRole = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: parseAbi(["function hasRole(bytes32 role, address account) view returns (bool)"]),
        functionName: 'hasRole',
        args: [teacherRole, teacherAddress as `0x${string}`],
      });
      postCheck.accessControl.hasTeacherRole = hasRole;
      log("Post-check: hasRole(TEACHER_ROLE)", { hasRole });
    } catch {
      postCheck.accessControl.hasTeacherRole = null;
    }

    try {
      const platformRole = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: parseAbi(["function PLATFORM_ROLE() view returns (bytes32)"]),
        functionName: 'PLATFORM_ROLE',
      });
      const hasRole = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: parseAbi(["function hasRole(bytes32 role, address account) view returns (bool)"]),
        functionName: 'hasRole',
        args: [platformRole, teacherAddress as `0x${string}`],
      });
      postCheck.accessControl.hasPlatformRole = hasRole;
      log("Post-check: hasRole(PLATFORM_ROLE)", { hasRole });
    } catch {
      postCheck.accessControl.hasPlatformRole = null;
    }

    // Check mapping methods
    const checkMethods = [
      { name: 'isTeacher', abi: "function isTeacher(address) view returns (bool)" },
      { name: 'isApprovedTeacher', abi: "function isApprovedTeacher(address) view returns (bool)" },
      { name: 'approvedTeachers', abi: "function approvedTeachers(address) view returns (bool)" },
      { name: 'teachers', abi: "function teachers(address) view returns (bool)" },
    ];

    for (const method of checkMethods) {
      try {
        const value = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: parseAbi([method.abi]),
          functionName: method.name,
          args: [teacherAddress as `0x${string}`],
        });
        postCheck.mappingChecks[method.name] = value;
        log(`Post-check: ${method.name}()`, { value });
      } catch {
        postCheck.mappingChecks[method.name] = null;
      }
    }

    log("=== ✓ APPROVE TEACHER SUCCESS ===");

    return new Response(
      JSON.stringify({
        ok: true,
        debugId,
        txHash: receipt.transactionHash,
        adminSigner,
        teacherAddress,
        receiptStatus: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
        methodUsed: "addTeacher(address)",
        postCheck
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("APPROVE_TEACHER_ERROR", JSON.stringify({
      debugId,
      error: err?.message,
      code: err?.code,
      stack: err?.stack
    }, null, 2));

    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || "Unknown error",
        debugId
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});