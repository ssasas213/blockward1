import { createPublicClient, createWalletClient, http, parseAbi, keccak256, toBytes } from "npm:viem@2.7.0";
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

Deno.serve(async (req) => {
  const debugId = generateDebugId();

  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json(
      { ok: false, error: 'Method not allowed', debugId },
      { status: 405 }
    );
  }

  try {
    // Authenticate user
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json(
        { ok: false, error: 'Unauthorized', debugId },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { studentVault, teacherVault, awardType, tokenURI, confirmations } = body;

    // Validate required fields
    const missing = [];
    if (!studentVault) missing.push('studentVault');
    if (!teacherVault) missing.push('teacherVault');
    if (!awardType) missing.push('awardType');
    if (!tokenURI) missing.push('tokenURI');

    if (missing.length > 0) {
      return Response.json({
        ok: false,
        error: 'Missing required fields',
        missing,
        debugId,
      }, { status: 400 });
    }

    // Validate addresses
    if (!isValidAddress(studentVault)) {
      return Response.json({
        ok: false,
        error: 'Invalid studentVault address',
        debugId,
      }, { status: 400 });
    }

    if (!isValidAddress(teacherVault)) {
      return Response.json({
        ok: false,
        error: 'Invalid teacherVault address',
        debugId,
      }, { status: 400 });
    }

    // Get environment variables
    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    const contract = Deno.env.get("CONTRACT_ADDRESS");
    const pk = Deno.env.get("ISSUER_PRIVATE_KEY");

    if (!rpcUrl || !contract || !pk) {
      return Response.json({
        ok: false,
        error: 'Server configuration error',
        debugId,
      }, { status: 500 });
    }

    // Convert awardType to bytes32
    const awardTypeBytes32 = ensureBytes32(awardType);

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
      args: [studentVault, teacherVault, awardTypeBytes32, tokenURI],
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

    return Response.json({
      ok: true,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      confirmations: confirmsToWait,
      debugId,
    });

  } catch (e) {
    // Check for common revert reasons
    let errorMessage = String(e?.message || e);
    
    // Extract revert reason if available
    if (errorMessage.includes('execution reverted')) {
      const match = errorMessage.match(/execution reverted[:\s]+"?([^"]+)"?/i);
      if (match) {
        errorMessage = `Contract reverted: ${match[1]}`;
      }
    }

    return Response.json({
      ok: false,
      error: errorMessage,
      debugId,
      details: e?.shortMessage || null,
    }, { status: 500 });
  }
});