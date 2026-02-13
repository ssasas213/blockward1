import { ethers } from "npm:ethers@6.13.0";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

// BlockWard AccessControl ABI
const BLOCKWARD_ABI = [
  "function TEACHER_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account)",
  "function hasRole(bytes32 role, address account) view returns (bool)"
];

function generateDebugId() {
  return `AT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

Deno.serve(async (req) => {
  const debugId = generateDebugId();

  const log = (message, obj = {}) => {
    console.log(JSON.stringify({ debugId, message, ...obj }));
  };

  try {
    log("=== APPROVE TEACHER START ===", { method: req.method });

    // CORS handling
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

    // Authenticate user
    log("Authenticating user...");
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      log("Unauthorized - no user");
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized', debugId }),
        { status: 401, headers: corsHeaders }
      );
    }
    
    log("User authenticated", { email: user.email });

    // Parse request body
    const body = await req.json();
    log("Request body received", { body });
    
    const { teacherVault } = body;

    // Validate required field
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

    // Validate address format
    if (!ethers.isAddress(teacherVault)) {
      log("Invalid teacher vault address format", { teacherVault });
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

    // Get environment variables - ONLY use secrets
    log("Loading environment variables...");
    const contractAddress = Deno.env.get("CONTRACT_ADDRESS");
    const issuerPrivateKey = Deno.env.get("ISSUER_PRIVATE_KEY");
    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    const network = Deno.env.get("NETWORK") || "sepolia";

    // CRITICAL: Validate RPC URL is set
    if (!rpcUrl) {
      log("CRITICAL: SEPOLIA_RPC_URL not configured");
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'BAD_RPC_URL',
          message: 'SEPOLIA_RPC_URL secret not set',
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Extract and log RPC hostname
    let rpcHost;
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

    log("Environment loaded", {
      network,
      rpcHost,
      contractSet: !!contractAddress,
      pkSet: !!issuerPrivateKey
    });

    // CRITICAL: Reject public RPC
    if (rpcHost === 'rpc.sepolia.org') {
      log("CRITICAL: Public RPC detected - rejecting");
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
          message: 'Contract address or private key not configured',
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Setup ethers provider and signer
    log("Setting up ethers provider and signer...", { rpcHost });
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(issuerPrivateKey, provider);
    
    log("Signer initialized", { signerAddress: wallet.address });

    // Create contract instance
    const contract = new ethers.Contract(contractAddress, BLOCKWARD_ABI, wallet);
    log("Contract instance created", { contractAddress });

    // Get TEACHER_ROLE from contract
    log("Fetching TEACHER_ROLE constant...");
    const TEACHER_ROLE = await contract.TEACHER_ROLE();
    log("TEACHER_ROLE fetched", { teacherRole: TEACHER_ROLE });

    // Check if teacher already has role
    log("Checking if teacher already has role...");
    const hasRole = await contract.hasRole(TEACHER_ROLE, teacherVault);
    
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

    // Grant teacher role
    log("Granting TEACHER_ROLE...", { teacherVault, teacherRole: TEACHER_ROLE });
    const tx = await contract.grantRole(TEACHER_ROLE, teacherVault);
    log("Transaction sent", { txHash: tx.hash });

    // Wait for confirmation
    log("Waiting for confirmation...");
    const receipt = await tx.wait();
    
    log("Transaction confirmed", {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status
    });

    log("=== ✓ APPROVE TEACHER SUCCESS ===");

    return new Response(
      JSON.stringify({
        ok: true,
        debugId,
        txHash: receipt.hash,
        message: "Teacher approved successfully",
        teacherVault,
        network,
        blockNumber: receipt.blockNumber
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    // Log full error
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

    // Extract RPC host for error response
    let errorRpcHost = 'unknown';
    try {
      const errorRpcUrl = Deno.env.get('SEPOLIA_RPC_URL');
      if (errorRpcUrl) errorRpcHost = new URL(errorRpcUrl).hostname;
    } catch {}

    // Return structured error
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
          network: Deno.env.get('NETWORK') || 'sepolia',
          rpcHost: errorRpcHost,
          contractAddress: Deno.env.get('CONTRACT_ADDRESS') || 'not set'
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  }
});