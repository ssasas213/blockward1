import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { ethers } from 'npm:ethers@6.13.0';

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Compiled BlockWard Contract ABI
const BLOCKWARD_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "_name", "type": "string" },
      { "internalType": "string", "name": "_symbol", "type": "string" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "uri", "type": "string" }
    ],
    "name": "Minted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "string", "name": "uri", "type": "string" }
    ],
    "name": "mint",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "tokenCounter",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "uint256", "name": "index", "type": "uint256" }
    ],
    "name": "tokenOfOwnerByIndex",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

function generateDebugId() {
  return `BW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

Deno.serve(async (req) => {
  const debugId = generateDebugId();
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return Response.json(
      { error: 'Method not allowed', debugId },
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // 1. Defensive request body parsing
    const rawBody = await req.text();
    
    if (!rawBody || rawBody.trim() === '') {
      console.error(`[${debugId}] Empty request body`);
      return Response.json(
        { error: 'Empty request body', debugId },
        { status: 400, headers: corsHeaders }
      );
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error(`[${debugId}] Non-JSON request body:`, rawBody.substring(0, 200));
      return Response.json(
        { error: 'Non-JSON request body', debugId },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Validate required fields
    const { studentId, title, category, description } = payload;
    const missing = [];
    if (!studentId) missing.push('studentId');
    if (!title) missing.push('title');
    if (!category) missing.push('category');

    if (missing.length > 0) {
      console.error(`[${debugId}] Missing required fields:`, missing);
      return Response.json(
        { error: 'Missing required fields', missing, debugId },
        { status: 400, headers: corsHeaders }
      );
    }

    const base44 = createClientFromRequest(req);

    // Get secrets (backend-only, never exposed to frontend)
    const ISSUER_PRIVATE_KEY = Deno.env.get('ISSUER_PRIVATE_KEY');
    const SEPOLIA_RPC_URL = Deno.env.get('SEPOLIA_RPC_URL');
    const NETWORK = Deno.env.get('NETWORK') || 'sepolia';
    const CONTRACT_ADDRESS = Deno.env.get('CONTRACT_ADDRESS');
    
    // Network configuration - Sepolia testnet (use reliable public RPC)
    const RPC_URL = 'https://rpc.sepolia.org';

    if (!ISSUER_PRIVATE_KEY) {
      console.error(`[${debugId}] ISSUER_PRIVATE_KEY not configured`);
      return Response.json(
        { error: 'ISSUER_PRIVATE_KEY not configured', debugId },
        { status: 500, headers: corsHeaders }
      );
    }

    if (!CONTRACT_ADDRESS) {
      console.error(`[${debugId}] CONTRACT_ADDRESS not configured`);
      return Response.json(
        { error: 'CONTRACT_ADDRESS not configured. Deploy contract first.', debugId },
        { status: 500, headers: corsHeaders }
      );
    }

    // Get current user (issuer)
    const issuer = await base44.auth.me();
    if (!issuer) {
      console.error(`[${debugId}] Unauthorized - no authenticated user`);
      return Response.json(
        { error: 'Unauthorized', debugId },
        { status: 401, headers: corsHeaders }
      );
    }

    // Log configuration for debugging
    const rpcHost = new URL(RPC_URL).hostname;
    console.log(`[${debugId}] 🔧 Configuration:`);
    console.log(`[${debugId}] - Network: ${NETWORK}`);
    console.log(`[${debugId}] - RPC Host: ${rpcHost}`);
    console.log(`[${debugId}] - Contract Address: ${CONTRACT_ADDRESS}`);
    console.log(`[${debugId}] - Issuer: ${issuer.email}`);

    // Get student profile to retrieve wallet address
    const students = await base44.asServiceRole.entities.UserProfile.filter({ id: studentId });
    if (students.length === 0) {
      console.error(`[${debugId}] Student not found: ${studentId}`);
      return Response.json(
        { error: 'Student not found', debugId },
        { status: 404, headers: corsHeaders }
      );
    }
    const student = students[0];

    if (!student.wallet_address) {
      console.error(`[${debugId}] Student does not have a wallet address: ${studentId}`);
      return Response.json(
        { error: 'Student does not have a wallet address', debugId },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate wallet address
    if (!ethers.isAddress(student.wallet_address)) {
      console.error(`[${debugId}] Invalid student wallet address: ${student.wallet_address}`);
      return Response.json(
        { error: 'Invalid student wallet address', debugId },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get issuer profile
    const issuerProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: issuer.email });
    if (issuerProfiles.length === 0) {
      console.error(`[${debugId}] Issuer profile not found: ${issuer.email}`);
      return Response.json(
        { error: 'Issuer profile not found', debugId },
        { status: 404, headers: corsHeaders }
      );
    }
    const issuerProfile = issuerProfiles[0];

    // SERVER-SIDE SIGNING: Connect to Sepolia via JsonRpcProvider (NO METAMASK)
    console.log(`[${debugId}] 🔐 Connecting to Sepolia via server-side wallet...`);
    
    let provider, signer, contract;
    try {
      provider = new ethers.JsonRpcProvider(RPC_URL);
      console.log(`[${debugId}] ✅ Provider created: ${rpcHost}`);
    } catch (providerError) {
      console.error(`[${debugId}] ❌ Failed to create provider:`, providerError);
      return Response.json({
        ok: false,
        debugId,
        message: 'Failed to connect to Sepolia RPC',
        details: providerError.message,
        code: providerError.code,
        reason: providerError.reason,
        shortMessage: providerError.shortMessage,
        config: { network: NETWORK, rpcHost, contractAddress: CONTRACT_ADDRESS }
      }, { status: 500, headers: corsHeaders });
    }

    try {
      signer = new ethers.Wallet(ISSUER_PRIVATE_KEY, provider);
      console.log(`[${debugId}] 📝 Signer address: ${signer.address}`);
    } catch (walletError) {
      console.error(`[${debugId}] ❌ Failed to create wallet:`, walletError);
      return Response.json({
        ok: false,
        debugId,
        message: 'Failed to create wallet from private key',
        details: walletError.message,
        code: walletError.code,
        reason: walletError.reason,
        shortMessage: walletError.shortMessage,
        config: { network: NETWORK, rpcHost, contractAddress: CONTRACT_ADDRESS }
      }, { status: 500, headers: corsHeaders });
    }

    try {
      contract = new ethers.Contract(CONTRACT_ADDRESS, BLOCKWARD_ABI, signer);
      console.log(`[${debugId}] 📄 Contract connected: ${CONTRACT_ADDRESS}`);
    } catch (contractError) {
      console.error(`[${debugId}] ❌ Failed to create contract instance:`, contractError);
      return Response.json({
        ok: false,
        debugId,
        message: 'Failed to connect to smart contract',
        details: contractError.message,
        code: contractError.code,
        reason: contractError.reason,
        shortMessage: contractError.shortMessage,
        config: { network: NETWORK, rpcHost, contractAddress: CONTRACT_ADDRESS }
      }, { status: 500, headers: corsHeaders });
    }

    // Create metadata JSON (in production, upload to IPFS)
    const metadata = {
      name: title,
      description: description || '',
      category: category,
      image: `https://api.dicebear.com/7.x/shapes/svg?seed=${title}`,
      attributes: [
        { trait_type: 'Category', value: category },
        { trait_type: 'Student', value: `${student.first_name} ${student.last_name}` },
        { trait_type: 'Issued Date', value: new Date().toISOString() }
      ]
    };

    // Fix base64 encoding for Unicode characters
    const metadataJSON = JSON.stringify(metadata);
    const metadataB64 = btoa(unescape(encodeURIComponent(metadataJSON)));
    const metadataURI = `data:application/json;base64,${metadataB64}`;

    // Log blockchain call parameters
    console.log(`[${debugId}] 🎨 Minting BlockWard:`);
    console.log(`[${debugId}] - Recipient: ${student.wallet_address}`);
    console.log(`[${debugId}] - Title: ${title}`);
    console.log(`[${debugId}] - Category: ${category}`);
    console.log(`[${debugId}] - Network: ${NETWORK}`);

    // SERVER-SIDE MINT: Backend signs and sends transaction directly to Sepolia
    let tx;
    try {
      console.log(`[${debugId}] 📤 Submitting mint transaction to Sepolia...`);
      tx = await contract.mint(student.wallet_address, metadataURI);
      console.log(`[${debugId}] ✅ Transaction submitted: ${tx.hash}`);
    } catch (mintError) {
      console.error(`[${debugId}] ❌ Mint transaction failed:`, mintError);
      console.error(`[${debugId}] Error stack:`, mintError.stack);
      console.error(`[${debugId}] Full error object:`, JSON.stringify(mintError, null, 2));
      return Response.json({
        ok: false,
        debugId,
        message: mintError.reason || mintError.message || 'Failed to submit mint transaction',
        details: mintError.message,
        code: mintError.code,
        reason: mintError.reason,
        shortMessage: mintError.shortMessage,
        stack: mintError.stack,
        data: mintError.data,
        config: { 
          network: NETWORK, 
          rpcHost, 
          contractAddress: CONTRACT_ADDRESS,
          recipient: student.wallet_address,
          signerAddress: signer.address
        }
      }, { status: 500, headers: corsHeaders });
    }
    
    console.log(`[${debugId}] ⏳ Waiting for transaction confirmation...`);
    
    let receipt;
    try {
      receipt = await tx.wait();
    } catch (waitError) {
      console.error(`[${debugId}] ❌ Transaction wait failed:`, waitError);
      console.error(`[${debugId}] Error stack:`, waitError.stack);
      return Response.json({
        ok: false,
        debugId,
        message: waitError.reason || waitError.message || 'Transaction failed or reverted',
        details: waitError.message,
        code: waitError.code,
        reason: waitError.reason,
        shortMessage: waitError.shortMessage,
        stack: waitError.stack,
        txHash: tx.hash,
        config: { network: NETWORK, rpcHost, contractAddress: CONTRACT_ADDRESS }
      }, { status: 500, headers: corsHeaders });
    }

    console.log(`[${debugId}] ✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`[${debugId}] 📋 Receipt status: ${receipt.status}`);
    console.log(`[${debugId}] 📊 Number of logs: ${receipt.logs.length}`);
    
    // Log all events for debugging
    receipt.logs.forEach((log, index) => {
      try {
        const parsed = contract.interface.parseLog(log);
        console.log(`[${debugId}] 📄 Event ${index}: ${parsed?.name}`, parsed?.args);
      } catch {
        console.log(`[${debugId}] 📄 Log ${index}: Unable to parse (may be from different contract)`);
      }
    });

    // Parse token ID from Minted event
    const mintedEvent = receipt.logs.find(log => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed?.name === 'Minted';
      } catch {
        return false;
      }
    });
    
    // Also check for Transfer event
    const transferEvent = receipt.logs.find(log => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed?.name === 'Transfer';
      } catch {
        return false;
      }
    });
    
    console.log(`[${debugId}] 🎯 Minted event found: ${!!mintedEvent}`);
    console.log(`[${debugId}] 🎯 Transfer event found: ${!!transferEvent}`);
    
    if (!mintedEvent && !transferEvent) {
      console.error(`[${debugId}] ❌ No Transfer or Minted event found in transaction receipt`);
      return Response.json(
        { 
          error: 'No Transfer or Minted event found in transaction receipt. NFT may not have been minted.',
          txHash: receipt.hash,
          debugId 
        },
        { status: 500, headers: corsHeaders }
      );
    }
    
    const tokenId = mintedEvent 
      ? contract.interface.parseLog(mintedEvent).args.tokenId.toString() 
      : (transferEvent ? contract.interface.parseLog(transferEvent).args.tokenId.toString() : '0');

    // Save BlockWard record to database
    await base44.asServiceRole.entities.BlockWard.create({
      student_email: student.user_email,
      student_name: `${student.first_name} ${student.last_name}`,
      student_wallet: student.wallet_address,
      issuer_email: issuer.email,
      issuer_name: `${issuerProfile.first_name} ${issuerProfile.last_name}`,
      issuer_wallet: 'system',
      school_id: issuerProfile.school_id,
      title: title,
      description: description || '',
      category: category,
      token_id: tokenId.toString(),
      metadata_uri: metadataURI,
      transaction_hash: receipt.hash,
      block_number: receipt.blockNumber,
      minted_at: new Date().toISOString(),
      status: 'active'
    });

    console.log(`[${debugId}] ✅ BlockWard issued successfully - Token ID: ${tokenId}`);

    return Response.json({
      success: true,
      txHash: receipt.hash,
      tokenId: tokenId.toString(),
      network: 'sepolia',
      explorerUrl: `https://sepolia.etherscan.io/tx/${receipt.hash}`,
      blockNumber: receipt.blockNumber,
      debugId
    }, { headers: corsHeaders });

  } catch (error) {
    console.error(`[${debugId}] ❌ Unexpected error issuing BlockWard:`, error);
    console.error(`[${debugId}] Stack trace:`, error.stack);
    console.error(`[${debugId}] Full error:`, JSON.stringify(error, null, 2));
    
    return Response.json({
      ok: false,
      debugId,
      message: error.reason || error.message || 'Failed to issue BlockWard on blockchain',
      details: error.message,
      code: error.code,
      reason: error.reason,
      shortMessage: error.shortMessage,
      stack: error.stack,
      config: { 
        network: Deno.env.get('NETWORK') || 'sepolia',
        rpcHost: Deno.env.get('SEPOLIA_RPC_URL') ? new URL(Deno.env.get('SEPOLIA_RPC_URL')).hostname : 'unknown',
        contractAddress: Deno.env.get('CONTRACT_ADDRESS') || 'not set'
      }
    }, { status: 500, headers: corsHeaders });
  }
});