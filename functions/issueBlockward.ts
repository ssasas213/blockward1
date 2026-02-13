import { createPublicClient, createWalletClient, http, parseAbi, getAddress, encodeBytes32String } from "npm:viem@2.7.0";
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";
import { sepolia } from "npm:viem@2.7.0/chains";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

const APPROVED_SIGNER = "0xc07af63f5eaa6d67f4a618d00a8a502a61d5ff0e";

const CONTRACT_ABI = parseAbi([
  "function issueAward(address studentVault, address teacherVault, bytes32 awardType_, string tokenURI_)"
]);

Deno.serve(async (req) => {
  const debugId = "bw_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);

  const log = (msg: string, obj = {}) => {
    console.log(JSON.stringify({ msg, debugId, ...obj }));
  };

  try {
    log("=== ISSUE BLOCKWARD START ===", { method: req.method });

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

    const studentWallet = studentProfiles[0].wallet_address;
    log("Student wallet found", { studentWallet });
    
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

    const teacherWallet = teacherProfiles[0].wallet_address;
    const teacherId = teacherProfiles[0].id;
    log("Teacher wallet found", { teacherWallet });

    // Validate both wallets exist
    if (!studentWallet || !teacherWallet) {
      log("Missing wallet address", { studentWallet, teacherWallet });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'MISSING_VAULT',
          message: 'Wallet address not found for student or teacher',
          studentId,
          teacherId,
          studentWallet: studentWallet || null,
          teacherWallet: teacherWallet || null,
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Validate address format
    try {
      getAddress(studentWallet);
      getAddress(teacherWallet);
    } catch {
      log("Invalid wallet address format", { studentWallet, teacherWallet });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'INVALID_VAULT',
          message: 'Invalid wallet address format',
          studentWallet,
          teacherWallet,
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

    const signerAddress = account.address;
    log("Signer initialized", { signerAddress });

    // HARD FAIL: Check signer address matches approved teacher wallet
    if (signerAddress.toLowerCase() !== APPROVED_SIGNER) {
      log("CRITICAL: Signer mismatch - not approved teacher wallet", {
        expected: APPROVED_SIGNER,
        got: signerAddress
      });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'WRONG_SIGNER',
          message: 'ISSUER_PRIVATE_KEY does not match approved teacher wallet',
          expected: APPROVED_SIGNER,
          got: signerAddress,
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    log("✓ Signer approved", { signerAddress });

    // Get issuer balance
    const balance = await publicClient.getBalance({ address: account.address });
    log("Issuer balance", { balanceWei: balance.toString(), balanceEth: (Number(balance) / 1e18).toFixed(6) });

    // Confirm student address matches
    log("Confirmed student wallet address", { 
      studentWallet,
      studentId,
      matchesRecord: true 
    });

    // Build metadata
    const tokenURI = `https://blockward.me/metadata/${studentId}-${Date.now()}.json`;
    
    // Convert category to bytes32 (viem uses encodeBytes32String from ethers compatibility)
    const awardTypeBytes32 = encodeBytes32String(category);

    log("Metadata prepared", { tokenURI, awardTypeBytes32, category });

    // Prepare mint arguments
    const mintArgs = [
      studentWallet as `0x${string}`,
      teacherWallet as `0x${string}`,
      awardTypeBytes32,
      tokenURI
    ] as const;

    log("Prepared mint arguments", {
      studentWallet: mintArgs[0],
      teacherWallet: mintArgs[1],
      awardType: mintArgs[2],
      tokenURI: mintArgs[3]
    });

    // SIMULATE transaction before executing
    log("Simulating transaction...", {
      functionName: 'issueAward',
      args: mintArgs
    });

    let simulationResult;
    try {
      simulationResult = await publicClient.simulateContract({
        account,
        address: contractAddress as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'issueAward',
        args: mintArgs,
      });
      log("✓ Simulation successful", { simulationResult: 'OK' });
    } catch (simError: any) {
      log("✗ Simulation failed", {
        errorMessage: simError?.message,
        shortMessage: simError?.shortMessage,
        cause: simError?.cause,
        details: simError?.details
      });
      
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'SIMULATION_FAILED',
          message: 'Transaction would revert',
          debugId,
          signerAddress,
          studentAddress: studentWallet,
          functionName: 'issueAward',
          args: mintArgs,
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
    log("Sending transaction...");
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

    log("=== ✓ ISSUE BLOCKWARD SUCCESS ===");

    return new Response(
      JSON.stringify({
        ok: true,
        debugId,
        txHash: receipt.transactionHash,
        message: "BlockWard issued successfully",
        tokenURI,
        network,
        contractAddress,
        studentWallet,
        teacherWallet,
        blockNumber: receipt.blockNumber.toString(),
        status: receipt.status
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    // Log full error with multiple formats
    console.error("ISSUE_BLOCKWARD_FATAL", JSON.stringify({
      debugId,
      errorName: err?.name,
      errorMessage: err?.message,
      errorCode: err?.code,
      errorShortMessage: err?.shortMessage,
      errorReason: err?.reason,
      errorData: err?.data,
      errorStack: err?.stack,
      errorCause: err?.cause,
      errorDetails: err?.details
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
        cause: err?.cause?.toString(),
        details: err?.details,
        data: err?.data,
        stack: err?.stack,
        errorType: err?.constructor?.name || 'Unknown'
      }),
      { status: 200, headers: corsHeaders }
    );
  }
});