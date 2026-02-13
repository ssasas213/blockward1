import { ethers } from "npm:ethers@6.13.0";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  const debugId = "bw_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);

  // Log helper that always includes debugId
  const log = (message, obj = {}) => {
    console.log(JSON.stringify({ debugId, message, ...obj }));
  };

  try {
    log("=== ISSUE BLOCKWARD START ===", { method: req.method });

    // CORS handling
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
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
    
    const { studentId, title, category, description } = body;

    // Validate required fields
    const missing = [];
    if (!studentId) missing.push('studentId');
    if (!title) missing.push('title');
    if (!category) missing.push('category');
    if (!description) missing.push('description');

    if (missing.length > 0) {
      log("Missing required fields", { missing });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'MISSING_FIELDS',
          message: 'Missing required fields',
          missing,
          debugId,
          received: body
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Query student vault
    log("Querying student profile", { studentId });
    const studentProfiles = await base44.entities.UserProfile.filter({ id: studentId });
    
    if (!studentProfiles || studentProfiles.length === 0) {
      log("Student not found", { studentId });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'STUDENT_NOT_FOUND',
          message: 'Student not found',
          studentId,
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const studentVault = studentProfiles[0].wallet_address;
    log("Student vault found", { studentVault });
    
    // Query teacher vault
    log("Querying teacher profile", { email: user.email });
    const teacherProfiles = await base44.entities.UserProfile.filter({ user_email: user.email });
    
    if (!teacherProfiles || teacherProfiles.length === 0) {
      log("Teacher profile not found", { email: user.email });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'TEACHER_NOT_FOUND',
          message: 'Teacher profile not found',
          teacherId: user.email,
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const teacherVault = teacherProfiles[0].wallet_address;
    const teacherId = teacherProfiles[0].id;
    log("Teacher vault found", { teacherVault });

    // Validate both vaults exist
    if (!studentVault || !teacherVault) {
      log("Missing vault address", { studentVault, teacherVault });
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
        { status: 200, headers: corsHeaders }
      );
    }

    // Validate address format
    if (!ethers.isAddress(studentVault) || !ethers.isAddress(teacherVault)) {
      log("Invalid vault address format", { studentVault, teacherVault });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'INVALID_VAULT',
          message: 'Invalid vault address format',
          studentVault,
          teacherVault,
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Get environment variables - ONLY use secrets, NEVER fallback to public RPC
    log("Loading environment variables...");
    const network = Deno.env.get("NETWORK");
    const contractAddress = Deno.env.get("CONTRACT_ADDRESS");
    const issuerPrivateKey = Deno.env.get("ISSUER_PRIVATE_KEY");
    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");

    // CRITICAL: Validate RPC URL is set BEFORE proceeding
    if (!rpcUrl) {
      log("CRITICAL: SEPOLIA_RPC_URL not configured");
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'BAD_RPC_URL',
          message: 'SEPOLIA_RPC_URL secret not set. Configure your Alchemy URL in dashboard settings.',
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Extract and log RPC hostname (not full URL with key)
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
      pkSet: !!issuerPrivateKey,
      rpcSet: !!rpcUrl
    });

    // CRITICAL: Reject public RPC fallback
    if (rpcHost === 'rpc.sepolia.org') {
      log("CRITICAL: Public RPC detected - rejecting");
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'BAD_RPC_URL',
          message: 'Using unreliable public RPC. Set SEPOLIA_RPC_URL to your Alchemy endpoint.',
          rpcHost,
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Validate configuration
    if (network !== "sepolia") {
      log("Unsupported network", { network });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'UNSUPPORTED_NETWORK',
          message: `Network "${network}" is not supported`,
          network,
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

    // Build metadata
    const timestamp = new Date().toISOString();
    const tokenURI = `https://blockward.me/metadata/${studentId}-${Date.now()}.json`;
    
    // Convert category to bytes32
    const awardTypeBytes32 = ethers.encodeBytes32String(category);

    log("Metadata prepared", { tokenURI, awardTypeBytes32, category });

    // Contract ABI
    const abi = [
      "function issueAward(address studentVault, address teacherVault, bytes32 awardType_, string tokenURI_)"
    ];

    // Create contract instance
    const contract = new ethers.Contract(contractAddress, abi, wallet);
    
    log("Contract instance created", { contractAddress });

    // Execute transaction
    log("Sending transaction...", {
      studentVault,
      teacherVault,
      awardType: awardTypeBytes32,
      tokenURI
    });

    const tx = await contract.issueAward(
      studentVault,
      teacherVault,
      awardTypeBytes32,
      tokenURI
    );

    log("Transaction sent", { txHash: tx.hash });

    // Wait for confirmation
    log("Waiting for confirmation...");
    const receipt = await tx.wait();
    
    log("Transaction confirmed", {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status
    });

    log("=== ✓ ISSUE BLOCKWARD SUCCESS ===");

    return new Response(
      JSON.stringify({
        ok: true,
        debugId,
        txHash: receipt.hash,
        message: "BlockWard issued successfully",
        tokenURI,
        network,
        contractAddress,
        studentVault,
        teacherVault,
        blockNumber: receipt.blockNumber
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    // Log full error with multiple formats
    console.error("ISSUE_BLOCKWARD_FATAL", { debugId, err });
    console.error("ISSUE_BLOCKWARD_FATAL_JSON", JSON.stringify({
      debugId,
      errorName: err?.name,
      errorMessage: err?.message,
      errorCode: err?.code,
      errorShortMessage: err?.shortMessage,
      errorReason: err?.reason,
      errorData: err?.data,
      errorStack: err?.stack,
      fullError: err
    }, null, 2));

    // Return structured error to frontend
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
        errorType: err?.constructor?.name || 'Unknown'
      }),
      { status: 200, headers: corsHeaders }
    );
  }
});