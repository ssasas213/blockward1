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
  "function hasRole(bytes32 role, address account) view returns (bool)"
]);

Deno.serve(async (req) => {
  const debugId = generateDebugId();

  const log = (message: string, obj = {}) => {
    console.log(JSON.stringify({ debugId, message, ...obj }));
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
    log("Request body received", { body });
    
    const { teacherVault } = body;

    if (!teacherVault) {
      log("Missing teacherVault");
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'MISSING_FIELD',
          message: 'Missing required field: teacherVault',
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Validate address format (viem will validate, but check early)
    if (!/^0x[a-fA-F0-9]{40}$/.test(teacherVault)) {
      log("Invalid address format", { teacherVault });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'INVALID_ADDRESS',
          message: 'Invalid teacher vault address format',
          teacherVault,
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Load environment
    log("Loading environment variables...");
    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    const contractAddress = Deno.env.get("CONTRACT_ADDRESS");
    const issuerPrivateKey = Deno.env.get("ISSUER_PRIVATE_KEY");

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

    log("Environment loaded", { rpcHost, contractSet: !!contractAddress, pkSet: !!issuerPrivateKey });

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

    if (!contractAddress || !issuerPrivateKey) {
      log("Missing contract or private key");
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'MISSING_CONFIG',
          message: 'CONTRACT_ADDRESS or ISSUER_PRIVATE_KEY not configured',
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Setup viem clients
    log("Setting up viem clients...", { rpcHost });
    const account = privateKeyToAccount(issuerPrivateKey as `0x${string}`);
    
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    });

    log("Clients initialized", { signerAddress: account.address });

    // Check if teacher already has role
    log("Checking if teacher already has role...");
    const hasRole = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'hasRole',
      args: [TEACHER_ROLE, teacherVault as `0x${string}`],
    });

    if (hasRole) {
      log("Teacher already approved", { teacherVault });
      return new Response(
        JSON.stringify({
          ok: true,
          debugId,
          message: "Teacher already has approval",
          teacherVault,
          alreadyApproved: true
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Simulate transaction
    log("Simulating grantRole transaction...");
    const { request } = await publicClient.simulateContract({
      account,
      address: contractAddress as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'grantRole',
      args: [TEACHER_ROLE, teacherVault as `0x${string}`],
    });

    log("Simulation successful, executing transaction...");

    // Execute transaction
    const txHash = await walletClient.writeContract(request);
    log("Transaction sent", { txHash });

    // Wait for confirmation
    log("Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    
    log("Transaction confirmed", {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber.toString(),
      status: receipt.status
    });

    log("=== ✓ APPROVE TEACHER SUCCESS ===");

    return new Response(
      JSON.stringify({
        ok: true,
        debugId,
        txHash: receipt.transactionHash,
        message: "Teacher approved successfully",
        teacherVault,
        blockNumber: receipt.blockNumber.toString()
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("APPROVE_TEACHER_FATAL", { debugId, err });
    console.error("APPROVE_TEACHER_FATAL_JSON", JSON.stringify({
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