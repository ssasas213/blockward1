import { createPublicClient, createWalletClient, http, parseAbi, keccak256, toBytes, stringToHex, pad } from "npm:viem@2.7.0";
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";
import { sepolia } from "npm:viem@2.7.0/chains";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Generate debug ID for request tracking
function generateDebugId() {
  return `bw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Validate Ethereum address format
function isValidAddress(addr) {
  return typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

// Convert string to bytes32 hash if needed
function ensureBytes32(input) {
  if (typeof input === 'string') {
    // If already bytes32 format (0x + 64 hex chars)
    if (/^0x[a-fA-F0-9]{64}$/.test(input)) {
      return input;
    }
    // Hash string to bytes32
    return keccak256(toBytes(input));
  }
  return input;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  const debugId = generateDebugId();

  try {
    // CORS handling
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Method not allowed', debugId }),
        {
          status: 405,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    // Authenticate user
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized', debugId }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const { studentId, title, category, description } = body;

    // Log input parameters
    console.log("DEBUG INPUT:", { studentId, title, category, description });

    // Validate required fields - strict schema
    const missing = [];
    if (!studentId) missing.push('studentId');
    if (!title) missing.push('title');
    if (!category) missing.push('category');
    if (!description) missing.push('description');

    if (missing.length > 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'MISSING_FIELDS',
          message: 'Missing required fields',
          missing,
          debugId,
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    // Query student vault
    const studentProfiles = await base44.entities.UserProfile.filter({ id: studentId });
    if (!studentProfiles || studentProfiles.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'STUDENT_NOT_FOUND',
          message: 'Student not found',
          studentId,
          debugId,
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    const studentVault = studentProfiles[0].wallet_address;
    
    // Query teacher vault
    const teacherProfiles = await base44.entities.UserProfile.filter({ user_email: user.email });
    if (!teacherProfiles || teacherProfiles.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'TEACHER_NOT_FOUND',
          message: 'Teacher profile not found',
          teacherId: user.email,
          debugId,
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    const teacherVault = teacherProfiles[0].wallet_address;
    const teacherId = teacherProfiles[0].id;

    // Validate both vaults exist
    if (!studentVault || !teacherVault) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'MISSING_VAULT',
          message: 'Vault address not found for student or teacher',
          studentId,
          teacherId,
          studentVault: studentVault || null,
          teacherVault: teacherVault || null,
          debugId,
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    if (!isValidAddress(studentVault) || !isValidAddress(teacherVault)) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'INVALID_VAULT',
          message: 'Invalid vault address format',
          studentVault,
          teacherVault,
          debugId,
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    // Get environment variables
    const network = Deno.env.get("NETWORK");
    const contract = Deno.env.get("CONTRACT_ADDRESS");
    const pk = Deno.env.get("ISSUER_PRIVATE_KEY");

    // RPC selection based on NETWORK
    let rpcUrl;
    if (network === "sepolia") {
      rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    } else {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'UNSUPPORTED_NETWORK',
          message: `Network "${network}" is not supported`,
          network,
          debugId,
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    // Validate RPC URL
    if (!rpcUrl) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'BAD_RPC_URL',
          message: 'RPC URL not configured',
          rpcUrl: null,
          network,
          debugId,
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    if (!rpcUrl.startsWith('https://')) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'BAD_RPC_URL',
          message: 'RPC URL must start with https://',
          rpcUrl,
          network,
          debugId,
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    // Check for accidental URL concatenation
    if (rpcUrl.indexOf('https://') !== rpcUrl.lastIndexOf('https://')) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'BAD_RPC_URL',
          message: 'RPC URL contains duplicate protocol',
          rpcUrl,
          network,
          debugId,
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    if (!contract || !pk) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'MISSING_CONFIG',
          message: 'Contract address or private key not configured',
          debugId,
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    // Build metadata JSON
    const timestamp = new Date().toISOString();
    const metadata = {
      name: title,
      description,
      category,
      studentId,
      teacherId,
      timestamp,
      attributes: [
        { trait_type: "Category", value: category }
      ]
    };

    // Convert category to bytes32
    const awardType = pad(stringToHex(category), { size: 32 });

    // Generate tokenURI
    const tokenURI = `https://blockward.me/metadata/${studentId}-${Date.now()}.json`;



    // Setup clients
    const account = privateKeyToAccount(pk);
    
    // Log configuration details
    console.log("DEBUG CONFIG:", {
      rpc: rpcUrl,
      contract: contract,
      signer: account.address
    });

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    });

    // Parse minimal ABI
    const abi = parseAbi([
      "function issueAward(address studentVault, address teacherVault, bytes32 awardType_, string tokenURI_)"
    ]);

    // Simulate transaction first (gas estimation and revert detection)
    const { request } = await publicClient.simulateContract({
      address: contract,
      abi,
      functionName: 'issueAward',
      args: [studentVault, teacherVault, awardType, tokenURI],
      account,
    });

    // Execute transaction
    const txHash = await walletClient.writeContract(request);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        debugId,
        txHash,
        message: "BlockWard issued successfully",
        tokenURI,
        network,
        contractAddress: contract,
        studentVault,
        teacherVault,
      }),
      {
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (err) {
    // Extract detailed error information
    const message = err?.shortMessage || err?.message || "Unknown blockchain error";
    const code = err?.code || 'ISSUE_FAILED_UNCAUGHT';
    
    // Get config values safely
    const network = Deno.env.get("NETWORK") || "unknown";
    const rpcUrl = network === "sepolia" ? Deno.env.get("SEPOLIA_RPC_URL") : null;
    const contract = Deno.env.get("CONTRACT_ADDRESS") || "unknown";

    const errorResponse = {
      ok: false,
      debugId,
      message,
      code,
      details: err,
    };

    // Log full error details for debugging with complete context
    console.error('BLOCKCHAIN ERROR:', {
      ...errorResponse,
      rpcUrl,
      network,
      contractAddress: contract,
      stack: err?.stack || String(err),
    });

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 200,
        headers: corsHeaders
      }
    );
  }
});