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
    const { studentId, title, category, description, confirmations } = body;

    // Validate required fields
    const missing = [];
    if (!studentId) missing.push('studentId');
    if (!title) missing.push('title');
    if (!category) missing.push('category');
    if (!description) missing.push('description');

    if (missing.length > 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Missing required fields',
          missing,
          debugId,
        }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    // Query student vault
    const studentProfiles = await base44.entities.UserProfile.filter({ id: studentId });
    if (!studentProfiles || studentProfiles.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Student not found',
          debugId,
        }),
        {
          status: 404,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    const studentVault = studentProfiles[0].wallet_address;
    if (!studentVault || !isValidAddress(studentVault)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Student vault address not found or invalid',
          debugId,
        }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    // Query teacher vault
    const teacherProfiles = await base44.entities.UserProfile.filter({ user_email: user.email });
    if (!teacherProfiles || teacherProfiles.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Teacher profile not found',
          debugId,
        }),
        {
          status: 404,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    const teacherVault = teacherProfiles[0].wallet_address;
    if (!teacherVault || !isValidAddress(teacherVault)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Teacher vault address not found or invalid',
          debugId,
        }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    // Build metadata JSON
    const metadata = {
      name: title,
      description,
      attributes: [
        { trait_type: "Category", value: category }
      ]
    };

    // Convert category to bytes32
    const awardType = pad(stringToHex(category), { size: 32 });

    // Generate temporary metadata URL
    const tokenURI = `https://blockward.me/metadata/${studentId}-${Date.now()}.json`;

    // Get environment variables
    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    const contract = Deno.env.get("CONTRACT_ADDRESS");
    const pk = Deno.env.get("ISSUER_PRIVATE_KEY");

    if (!rpcUrl || !contract || !pk) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Server configuration error',
          debugId,
        }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' }
        }
      );
    }



    // Setup clients
    const account = privateKeyToAccount(pk);

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

    // Wait for confirmation (clamp between 1-5)
    const confirmsToWait = Math.max(1, Math.min(5, confirmations || 1));
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: confirmsToWait,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        success: true,
        txHash,
      }),
      {
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (err) {
    // Extract detailed error information from viem
    const message = err?.message || String(err);
    const details = {
      shortMessage: err?.shortMessage || null,
      name: err?.name || null,
      code: err?.code || null,
      cause: err?.cause ? {
        shortMessage: err.cause?.shortMessage || null,
        message: err.cause?.message || null,
      } : null,
      metaMessages: err?.metaMessages || null,
    };

    // Log full error details for debugging
    console.error('issueBlockward failed', {
      debugId,
      message,
      details,
    });

    return new Response(
      JSON.stringify({
        ok: false,
        error: message,
        debugId,
        details,
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    );
  }
});