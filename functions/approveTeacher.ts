import { createPublicClient, createWalletClient, http, parseAbi, keccak256, toHex } from "npm:viem@2.7.0";
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";
import { sepolia } from "npm:viem@2.7.0/chains";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
  'content-type': 'application/json'
};

function generateDebugId() {
  return `AT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Compute TEACHER_ROLE = keccak256("TEACHER_ROLE")
const TEACHER_ROLE = keccak256(toHex("TEACHER_ROLE"));

const CONTRACT_ABI = parseAbi([
  "function grantRole(bytes32 role, address account)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function isApprovedTeacher(address teacher) view returns (bool)",
  "function approvedTeachers(address teacher) view returns (bool)"
]);

Deno.serve(async (req) => {
  const debugId = generateDebugId();

  const log = (msg: string, obj = {}) => {
    console.log(JSON.stringify({ msg, debugId, ...obj }));
  };

  try {
    log("=== APPROVE TEACHER START ===", { method: req.method });

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      log("Invalid method", { method: req.method });
      return new Response(
        JSON.stringify({ ok: false, error: 'Method not allowed', debugId }),
        { status: 405, headers: corsHeaders }
      );
    }

    // ADMIN-ONLY: Check X-Admin-Key header
    const adminKey = req.headers.get('X-Admin-Key');
    const expectedAdminKey = Deno.env.get('ADMIN_KEY');
    
    if (!expectedAdminKey) {
      log("ADMIN_KEY not configured in secrets");
      return new Response(
        JSON.stringify({ ok: false, error: 'ADMIN_KEY not configured', debugId }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (adminKey !== expectedAdminKey) {
      log("Unauthorized - invalid admin key");
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized - admin access required', debugId }),
        { status: 403, headers: corsHeaders }
      );
    }

    log("Admin authenticated");

    // Parse body
    const body = await req.json();
    log("Request body received", { action: body.action, teacherAddress: body.teacherAddress });
    
    const { action, teacherAddress } = body;

    if (!teacherAddress) {
      log("Missing teacherAddress");
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'MISSING_FIELD',
          message: 'Missing required field: teacherAddress',
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(teacherAddress)) {
      log("Invalid address format", { teacherAddress });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'INVALID_ADDRESS',
          message: 'Invalid teacher address format',
          teacherAddress,
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Load environment
    log("Loading environment variables...");
    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    const contractAddress = Deno.env.get("CONTRACT_ADDRESS");
    const adminPrivateKey = Deno.env.get("ADMIN_PRIVATE_KEY");

    if (!rpcUrl) {
      log("SEPOLIA_RPC_URL not configured");
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'BAD_RPC_URL',
          message: 'SEPOLIA_RPC_URL not set',
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    let rpcHost: string;
    try {
      rpcHost = new URL(rpcUrl).hostname;
    } catch {
      log("Invalid RPC URL format");
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'BAD_RPC_URL',
          message: 'Invalid SEPOLIA_RPC_URL format',
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    log("RPC_HOST", { rpcHost });

    if (rpcHost === 'rpc.sepolia.org') {
      log("Public RPC detected - rejecting");
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'BAD_RPC_URL',
          message: 'Using unreliable public RPC',
          rpcHost,
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    if (!contractAddress) {
      log("CONTRACT_ADDRESS not configured");
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'MISSING_CONFIG',
          message: 'CONTRACT_ADDRESS not configured',
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    log("CONTRACT_ADDRESS", { contractAddress });

    if (!adminPrivateKey) {
      log("ADMIN_PRIVATE_KEY not configured");
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'MISSING_CONFIG',
          message: 'ADMIN_PRIVATE_KEY not configured',
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Setup viem clients
    log("Setting up viem clients...");
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

    log("ADMIN_SIGNER", { adminSigner: account.address });
    log("TEACHER_TARGET", { teacherAddress });

    // Check approval status before (try multiple methods)
    log("Checking approval status...");
    let approvedBefore: boolean | null = null;
    
    try {
      // Try hasRole first (AccessControl pattern)
      approvedBefore = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'hasRole',
        args: [TEACHER_ROLE, teacherAddress as `0x${string}`],
      });
      log("Approval check via hasRole", { approvedBefore });
    } catch (e1) {
      log("hasRole failed, trying isApprovedTeacher", { error: e1?.message });
      try {
        approvedBefore = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: CONTRACT_ABI,
          functionName: 'isApprovedTeacher',
          args: [teacherAddress as `0x${string}`],
        });
        log("Approval check via isApprovedTeacher", { approvedBefore });
      } catch (e2) {
        log("isApprovedTeacher failed, trying approvedTeachers", { error: e2?.message });
        try {
          approvedBefore = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: CONTRACT_ABI,
            functionName: 'approvedTeachers',
            args: [teacherAddress as `0x${string}`],
          });
          log("Approval check via approvedTeachers", { approvedBefore });
        } catch (e3) {
          log("All approval check methods failed", { error: e3?.message });
          approvedBefore = null;
        }
      }
    }

    // If action is "check", return status without writing
    if (action === 'check') {
      log("Check mode - returning approval status only");
      return new Response(
        JSON.stringify({
          ok: true,
          debugId,
          action: 'check',
          teacherAddress,
          adminSigner: account.address,
          approvalStatus: approvedBefore,
          contractAddress,
          rpcHost
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // If already approved, return early
    if (approvedBefore === true) {
      log("Teacher already approved", { teacherAddress });
      return new Response(
        JSON.stringify({
          ok: true,
          debugId,
          message: "Teacher already has approval",
          teacherAddress,
          adminSigner: account.address,
          approvedBefore: true,
          approvedAfter: true,
          alreadyApproved: true
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Simulate transaction
    log("Simulating grantRole transaction...");
    let simulationResult;
    
    try {
      simulationResult = await publicClient.simulateContract({
        account,
        address: contractAddress as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'grantRole',
        args: [TEACHER_ROLE, teacherAddress as `0x${string}`],
      });
      log("✓ Simulation successful");
    } catch (simError: any) {
      log("✗ Simulation failed", {
        message: simError?.message,
        shortMessage: simError?.shortMessage,
        cause: simError?.cause,
        details: simError?.details
      });
      
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'SIMULATION_FAILED',
          message: simError?.shortMessage || simError?.message || 'Transaction would revert',
          debugId,
          teacherAddress,
          adminSigner: account.address,
          error: {
            message: simError?.message,
            shortMessage: simError?.shortMessage,
            cause: simError?.cause?.toString(),
            details: simError?.details
          }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Execute transaction
    log("Executing grantRole...");
    const txHash = await walletClient.writeContract(simulationResult.request);
    log("Transaction sent", { txHash });

    // Wait for confirmation
    log("Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    
    log("Transaction confirmed", {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber.toString(),
      status: receipt.status,
      gasUsed: receipt.gasUsed.toString()
    });

    // Check if receipt status is success
    if (receipt.status !== 'success') {
      log("✗ Transaction reverted", { status: receipt.status });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'TX_REVERTED',
          message: 'Transaction was included but reverted',
          debugId,
          txHash: receipt.transactionHash,
          receiptStatus: receipt.status,
          teacherAddress,
          adminSigner: account.address
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Check approval status after
    let approvedAfter: boolean | null = null;
    
    try {
      approvedAfter = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'hasRole',
        args: [TEACHER_ROLE, teacherAddress as `0x${string}`],
      });
      log("Approval check after tx", { approvedAfter });
    } catch (e) {
      log("Post-tx approval check failed", { error: e?.message });
      approvedAfter = null;
    }

    log("=== ✓ APPROVE TEACHER SUCCESS ===");

    return new Response(
      JSON.stringify({
        ok: true,
        debugId,
        teacherAddress,
        adminSigner: account.address,
        txHash: receipt.transactionHash,
        approvedBefore: approvedBefore ?? null,
        approvedAfter: approvedAfter ?? null,
        receiptStatus: receipt.status,
        blockNumber: receipt.blockNumber.toString()
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("APPROVE_TEACHER_FATAL", JSON.stringify({
      debugId,
      errorName: err?.name,
      errorMessage: err?.message,
      errorCode: err?.code,
      errorShortMessage: err?.shortMessage,
      errorReason: err?.reason,
      errorData: err?.data,
      errorStack: err?.stack
    }, null, 2));

    let errorRpcHost = 'unknown';
    try {
      const errorRpcUrl = Deno.env.get('SEPOLIA_RPC_URL');
      if (errorRpcUrl) errorRpcHost = new URL(errorRpcUrl).hostname;
    } catch {}

    return new Response(
      JSON.stringify({
        ok: false,
        debugId,
        message: err?.message ?? "Unknown error",
        code: err?.code,
        shortMessage: err?.shortMessage,
        reason: err?.reason,
        cause: err?.cause?.toString(),
        details: err?.details,
        data: err?.data,
        stack: err?.stack,
        config: {
          rpcHost: errorRpcHost,
          contractAddress: Deno.env.get('CONTRACT_ADDRESS') || 'not set'
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  }
});