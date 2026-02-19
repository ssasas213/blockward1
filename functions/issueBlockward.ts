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

const APPROVED_SIGNER = "0xC07aF63F5eaa6D67F4a618D00A8a502a61D5fF0e";

const CONTRACT_ABI = parseAbi([
  "function issueAward(address studentVault, address teacherVault, bytes32 awardType_, string tokenURI_)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event AwardIssued(address indexed student, address indexed teacher, uint256 indexed tokenId, bytes32 awardType)"
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
    
    // Sanitize payload for logging (remove sensitive data if any)
    const sanitizedPayload = {
      studentId: body.studentId,
      teacherAddress: body.teacherAddress,
      studentAddress: body.studentAddress,
      title: body.title,
      category: body.category,
      hasDescription: !!body.description,
      hasTokenURI: !!body.tokenURI
    };
    log("Request body received", { payload: sanitizedPayload });
    
    const { studentId, teacherAddress, studentAddress, title, category, description, tokenURI } = body;

    // Validate required fields
    const missing = [];
    if (!studentId) missing.push('studentId');
    if (!title) missing.push('title');
    if (!category) missing.push('category');

    if (missing.length > 0) {
      log("Missing required fields", { missing });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'MISSING_FIELDS',
          message: 'Missing required fields',
          missing,
          debugId,
          received: sanitizedPayload
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Resolve student address
    let resolvedStudentAddress = studentAddress;
    
    if (!resolvedStudentAddress) {
      log("studentAddress not in payload, loading from student record", { studentId });
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

      resolvedStudentAddress = studentProfiles[0].wallet_address;
      
      if (!resolvedStudentAddress) {
        log("Student has no wallet address", { studentId });
        return new Response(
          JSON.stringify({
            ok: false,
            code: 'STUDENT_NO_WALLET',
            message: 'Student does not have a wallet address',
            studentId,
            debugId,
          }),
          { status: 200, headers: corsHeaders }
        );
      }
      
      log("Student wallet loaded from DB", { studentAddress: resolvedStudentAddress });
    } else {
      log("Student address from payload", { studentAddress: resolvedStudentAddress });
    }

    // Validate student address format
    try {
      resolvedStudentAddress = getAddress(resolvedStudentAddress);
    } catch {
      log("Invalid student address format", { studentAddress: resolvedStudentAddress });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'INVALID_STUDENT_ADDRESS',
          message: 'Invalid student address format',
          studentAddress: resolvedStudentAddress,
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Resolve teacher address (for validation)
    let resolvedTeacherAddress = teacherAddress;
    
    if (!resolvedTeacherAddress) {
      log("teacherAddress not in payload, loading from teacher record", { email: user.email });
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

      resolvedTeacherAddress = teacherProfiles[0].wallet_address;
      
      if (!resolvedTeacherAddress) {
        log("Teacher has no wallet address", { email: user.email });
        return new Response(
          JSON.stringify({
            ok: false,
            code: 'TEACHER_NO_WALLET',
            message: 'Teacher does not have a wallet address',
            email: user.email,
            debugId,
          }),
          { status: 200, headers: corsHeaders }
        );
      }
      
      log("Teacher wallet loaded from DB", { teacherAddress: resolvedTeacherAddress });
    } else {
      log("Teacher address from payload", { teacherAddress: resolvedTeacherAddress });
    }

    // Validate teacher address format
    try {
      resolvedTeacherAddress = getAddress(resolvedTeacherAddress);
    } catch {
      log("Invalid teacher address format", { teacherAddress: resolvedTeacherAddress });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'INVALID_TEACHER_ADDRESS',
          message: 'Invalid teacher address format',
          teacherAddress: resolvedTeacherAddress,
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
    log("MINT_SIGNER", { signerAddress });

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

    // HARD FAIL: If teacherAddress provided, must match signer
    if (teacherAddress && resolvedTeacherAddress.toLowerCase() !== signerAddress.toLowerCase()) {
      log("CRITICAL: Teacher address does not match signer", {
        teacherAddress: resolvedTeacherAddress,
        signerAddress
      });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'TEACHER_SIGNER_MISMATCH',
          message: 'teacherAddress does not match ISSUER_PRIVATE_KEY signer',
          teacherAddress: resolvedTeacherAddress,
          signerAddress,
          debugId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    log("✓ Teacher address validated", { teacherAddress: resolvedTeacherAddress });

    // Get issuer balance
    const balance = await publicClient.getBalance({ address: account.address });
    log("Issuer balance", { balanceWei: balance.toString(), balanceEth: (Number(balance) / 1e18).toFixed(6) });

    // Log final mint recipient - minting to signer (teacher)
    log("MINT_TO", { recipientAddress: account.address, studentId });

    // Build or use provided tokenURI
    let finalTokenURI: string;
    
    if (tokenURI) {
      finalTokenURI = tokenURI;
      log("Using provided tokenURI", { tokenURI: finalTokenURI });
    } else {
      // Build base64 JSON metadata
      const metadata = {
        name: title,
        description: description || '',
        category: category,
        image: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(title)}`,
        attributes: [
          { trait_type: 'Category', value: category },
          { trait_type: 'Student ID', value: studentId },
          { trait_type: 'Issued Date', value: new Date().toISOString() }
        ]
      };
      
      const metadataJSON = JSON.stringify(metadata);
      const metadataB64 = btoa(unescape(encodeURIComponent(metadataJSON)));
      finalTokenURI = `data:application/json;base64,${metadataB64}`;
      
      log("Built base64 tokenURI", { hasMetadata: true });
    }
    
    // Convert category to bytes32
    const awardTypeBytes32 = encodeBytes32String(category);

    log("Metadata prepared", { tokenURI: finalTokenURI.substring(0, 100) + '...', awardTypeBytes32, category });

    // Prepare mint arguments - NFT goes to signer (teacher)
    const mintArgs = [
      account.address as `0x${string}`,
      resolvedTeacherAddress as `0x${string}`,
      awardTypeBytes32,
      finalTokenURI
    ] as const;

    log("Prepared mint arguments", {
      recipientAddress: mintArgs[0],
      teacherAddress: mintArgs[1],
      awardType: mintArgs[2],
      tokenURILength: finalTokenURI.length
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
          message: simError?.shortMessage || simError?.message || 'Transaction would revert',
          debugId,
          signerAddress,
          teacherAddress: resolvedTeacherAddress,
          studentAddress: resolvedStudentAddress,
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
    log("Sending mint transaction...");
    const txHash = await walletClient.writeContract(simulationResult.request);
    log("Mint transaction sent", { txHash });

    // Wait for confirmation
    log("Waiting for mint confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    
    log("Mint confirmed", {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber.toString(),
      status: receipt.status,
      gasUsed: receipt.gasUsed.toString()
    });

    // Extract tokenId from Transfer event
    let tokenId: bigint | null = null;
    for (const rlog of receipt.logs) {
      try {
        const decoded = publicClient.decodeEventLog({
          abi: CONTRACT_ABI,
          data: rlog.data,
          topics: rlog.topics
        });
        if (decoded.eventName === 'Transfer') {
          tokenId = decoded.args.tokenId as bigint;
          log("TokenId extracted from Transfer event", { tokenId: tokenId.toString() });
          break;
        }
      } catch {}
    }

    if (!tokenId) {
      log("✗ Failed to extract tokenId from receipt");
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'TOKEN_ID_NOT_FOUND',
          message: 'NFT minted but failed to extract token ID',
          debugId,
          mintTxHash: receipt.transactionHash
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Step 2: Transfer from teacher to student
    log("Transferring NFT to student...", { 
      from: account.address, 
      to: resolvedStudentAddress,
      tokenId: tokenId.toString()
    });

    let transferSimulation;
    try {
      transferSimulation = await publicClient.simulateContract({
        account,
        address: contractAddress as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'safeTransferFrom',
        args: [account.address as `0x${string}`, resolvedStudentAddress as `0x${string}`, tokenId],
      });
      log("✓ Transfer simulation successful");
    } catch (simError: any) {
      log("✗ Transfer simulation failed", {
        errorMessage: simError?.message,
        shortMessage: simError?.shortMessage
      });
      
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'TRANSFER_SIMULATION_FAILED',
          message: 'NFT minted to teacher but transfer to student failed',
          debugId,
          mintTxHash: receipt.transactionHash,
          tokenId: tokenId.toString(),
          error: simError?.shortMessage || simError?.message
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const transferTxHash = await walletClient.writeContract(transferSimulation.request);
    log("Transfer transaction sent", { transferTxHash });

    const transferReceipt = await publicClient.waitForTransactionReceipt({ hash: transferTxHash });
    log("Transfer confirmed", {
      transferTxHash: transferReceipt.transactionHash,
      blockNumber: transferReceipt.blockNumber.toString(),
      status: transferReceipt.status
    });

    log("=== ✓ ISSUE BLOCKWARD SUCCESS ===");

    return new Response(
      JSON.stringify({
        ok: true,
        debugId,
        mintTxHash: receipt.transactionHash,
        transferTxHash: transferReceipt.transactionHash,
        tokenId: tokenId.toString(),
        recipientAddress: resolvedStudentAddress,
        teacherAddress: resolvedTeacherAddress,
        studentAddress: resolvedStudentAddress,
        studentId,
        title,
        category,
        blockNumber: transferReceipt.blockNumber.toString(),
        status: transferReceipt.status
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