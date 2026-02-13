import { createPublicClient, createWalletClient, http, parseAbi } from "npm:viem@2.7.0";
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";
import { sepolia } from "npm:viem@2.7.0/chains";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  const debugId = `AT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const log = (msg: string, obj = {}) => {
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

    // ADMIN AUTH: Check X-Admin-Key header
    const adminKeyHeader = req.headers.get('X-Admin-Key');
    const expectedAdminKey = Deno.env.get('ADMIN_KEY');
    
    if (!expectedAdminKey || !adminKeyHeader || adminKeyHeader !== expectedAdminKey) {
      log("Unauthorized - invalid or missing admin key");
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized - invalid admin key', debugId }),
        { status: 401, headers: corsHeaders }
      );
    }

    log("Admin authenticated");

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

    // AUTO-DETECT APPROVAL METHOD
    log("Detecting approval method...");
    
    let approvalMethod = null;
    let simulationResult;
    let txHash;
    let receipt;

    // Strategy 1: Try grantRole(TEACHER_ROLE, address)
    try {
      log("Trying AccessControl: grantRole(TEACHER_ROLE, address)...");
      const teacherRole = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: parseAbi(["function TEACHER_ROLE() view returns (bytes32)"]),
        functionName: 'TEACHER_ROLE',
      });
      log("TEACHER_ROLE found", { role: teacherRole });

      simulationResult = await publicClient.simulateContract({
        account,
        address: contractAddress as `0x${string}`,
        abi: parseAbi(["function grantRole(bytes32 role, address account)"]),
        functionName: 'grantRole',
        args: [teacherRole, teacherAddress as `0x${string}`],
      });
      
      approvalMethod = "grantRole(TEACHER_ROLE)";
      log("✓ Will use grantRole(TEACHER_ROLE)");
    } catch (e1) {
      log("grantRole(TEACHER_ROLE) not available", { error: e1?.message });
    }

    // Strategy 2: Try addTeacher(address)
    if (!approvalMethod) {
      try {
        log("Trying addTeacher(address)...");
        simulationResult = await publicClient.simulateContract({
          account,
          address: contractAddress as `0x${string}`,
          abi: parseAbi(["function addTeacher(address teacher)"]),
          functionName: 'addTeacher',
          args: [teacherAddress as `0x${string}`],
        });
        
        approvalMethod = "addTeacher(address)";
        log("✓ Will use addTeacher(address)");
      } catch (e2) {
        log("addTeacher(address) not available", { error: e2?.message });
      }
    }

    // Strategy 3: Try approveTeacher(address, bool)
    if (!approvalMethod) {
      try {
        log("Trying approveTeacher(address, bool)...");
        simulationResult = await publicClient.simulateContract({
          account,
          address: contractAddress as `0x${string}`,
          abi: parseAbi(["function approveTeacher(address teacher, bool approved)"]),
          functionName: 'approveTeacher',
          args: [teacherAddress as `0x${string}`, true],
        });
        
        approvalMethod = "approveTeacher(address, bool)";
        log("✓ Will use approveTeacher(address, bool)");
      } catch (e3) {
        log("approveTeacher(address, bool) not available", { error: e3?.message });
      }
    }

    // Strategy 4: Try setTeacherApproval(address, bool)
    if (!approvalMethod) {
      try {
        log("Trying setTeacherApproval(address, bool)...");
        simulationResult = await publicClient.simulateContract({
          account,
          address: contractAddress as `0x${string}`,
          abi: parseAbi(["function setTeacherApproval(address teacher, bool approved)"]),
          functionName: 'setTeacherApproval',
          args: [teacherAddress as `0x${string}`, true],
        });
        
        approvalMethod = "setTeacherApproval(address, bool)";
        log("✓ Will use setTeacherApproval(address, bool)");
      } catch (e4) {
        log("setTeacherApproval(address, bool) not available", { error: e4?.message });
      }
    }

    if (!approvalMethod || !simulationResult) {
      log("✗ No approval method found");
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'NO_APPROVAL_METHOD_FOUND',
          message: 'No teacher approval method found on this contract',
          debugId,
          contractAddress,
          adminSigner,
          teacherAddress
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Execute transaction
    log("Executing transaction...", { method: approvalMethod });
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
        methodUsed: approvalMethod,
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