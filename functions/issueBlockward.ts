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
    console.log("=== ISSUE BLOCKWARD START ===");
    console.log("DEBUG ID:", debugId);
    console.log("METHOD:", req.method);

    // CORS handling
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (req.method !== 'POST') {
      console.error("❌ Invalid method:", req.method);
      return new Response(
        JSON.stringify({ ok: false, error: 'Method not allowed', debugId }),
        {
          status: 405,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    // Authenticate user
    console.log("→ Authenticating user...");
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      console.error("❌ Unauthorized - no user");
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized', debugId }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' }
        }
      );
    }
    
    console.log("✓ User authenticated:", user.email);

    // Parse request body
    const body = await req.json();
    console.log("REQUEST BODY:", body);
    
    const { studentId, title, category, description } = body;
    console.log("PARSED FIELDS:", { studentId, title, category, description });

    // Validate required fields - strict schema
    const missing = [];
    if (!studentId) missing.push('studentId');
    if (!title) missing.push('title');
    if (!category) missing.push('category');
    if (!description) missing.push('description');

    if (missing.length > 0) {
      console.error("❌ Missing fields:", missing);
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'MISSING_FIELDS',
          message: 'Missing required fields',
          missing,
          debugId,
          received: body
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    // Query student vault
    console.log("→ Querying student profile:", studentId);
    const studentProfiles = await base44.entities.UserProfile.filter({ id: studentId });
    if (!studentProfiles || studentProfiles.length === 0) {
      console.error("❌ Student not found:", studentId);
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
    console.log("✓ Student vault:", studentVault);
    
    // Query teacher vault
    console.log("→ Querying teacher profile:", user.email);
    const teacherProfiles = await base44.entities.UserProfile.filter({ user_email: user.email });
    if (!teacherProfiles || teacherProfiles.length === 0) {
      console.error("❌ Teacher profile not found:", user.email);
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
    console.log("✓ Teacher vault:", teacherVault);

    // Validate both vaults exist
    if (!studentVault || !teacherVault) {
      console.error("❌ Missing vault:", { studentVault, teacherVault });
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
      console.error("❌ Invalid vault format:", { studentVault, teacherVault });
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
    console.log("→ Loading environment variables...");
    const network = Deno.env.get("NETWORK");
    const contract = Deno.env.get("CONTRACT_ADDRESS");
    const pk = Deno.env.get("ISSUER_PRIVATE_KEY");
    console.log("ENV:", { network, contractSet: !!contract, pkSet: !!pk });

    // RPC selection based on NETWORK
    let rpcUrl;
    if (network === "sepolia") {
      rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
      console.log("✓ Using Sepolia network");
      console.log("RPC URL:", rpcUrl);
    } else {
      console.error("❌ Unsupported network:", network);
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
      console.error("❌ RPC URL not configured");
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
      console.error("❌ Invalid RPC URL protocol:", rpcUrl);
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
      console.error("❌ Duplicate protocol in RPC URL:", rpcUrl);
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
      console.error("❌ Missing contract or private key");
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
    console.log("→ Setting up blockchain clients...");
    const account = privateKeyToAccount(pk);
    console.log("✓ Signer address:", account.address);

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    });
    console.log("✓ Clients initialized");

    // Parse minimal ABI
    const abi = parseAbi([
      "function issueAward(address studentVault, address teacherVault, bytes32 awardType_, string tokenURI_)"
    ]);

    console.log("→ Simulating transaction...");
    console.log("Contract:", contract);
    console.log("Args:", { studentVault, teacherVault, awardType, tokenURI });

    // Simulate transaction first (gas estimation and revert detection)
    const { request } = await publicClient.simulateContract({
      address: contract,
      abi,
      functionName: 'issueAward',
      args: [studentVault, teacherVault, awardType, tokenURI],
      account,
    });
    console.log("✓ Simulation successful");

    // Execute transaction
    console.log("→ Sending transaction...");
    const txHash = await walletClient.writeContract(request);
    console.log("TX SENT:", txHash);

    // Wait for confirmation
    console.log("→ Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });
    console.log("✓ Transaction confirmed:", receipt.transactionHash);

    console.log("=== ✓ ISSUE BLOCKWARD SUCCESS ===");
    
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
    console.error("=== ❌ ISSUE BLOCKWARD FAILED ===");
    console.error("DEBUG ID:", debugId);
    console.error("ERROR TYPE:", err?.constructor?.name);
    console.error("ERROR MESSAGE:", err?.message);
    console.error("ERROR CODE:", err?.code);
    console.error("SHORT MESSAGE:", err?.shortMessage);
    console.error("FULL ERROR:", err);
    console.error("STACK:", err?.stack);
    
    // Get config values safely
    const network = Deno.env.get("NETWORK") || "unknown";
    const rpcUrl = network === "sepolia" ? Deno.env.get("SEPOLIA_RPC_URL") : null;
    const contract = Deno.env.get("CONTRACT_ADDRESS") || "unknown";
    
    console.error("CONFIG AT ERROR:", {
      network,
      rpcUrl,
      contract,
      hasPrivateKey: !!Deno.env.get("ISSUER_PRIVATE_KEY")
    });

    const errorResponse = {
      ok: false,
      debugId,
      message: err?.shortMessage || err?.message || "Unknown blockchain error",
      code: err?.code || 'ISSUE_FAILED_UNCAUGHT',
      errorType: err?.constructor?.name || 'Unknown',
      details: String(err)
    };

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 200,
        headers: corsHeaders
      }
    );
  }
});