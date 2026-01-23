import { ethers } from 'npm:ethers@6.13.0';

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

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Issue a BlockWard NFT on Polygon Amoy testnet
 * All blockchain operations happen server-side
 * Frontend never touches private keys
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { studentId, title, category, description } = body;

    // Validate required fields
    if (!studentId || !title || !category) {
      return Response.json({ error: 'Missing required fields: studentId, title, category' }, { status: 400 });
    }

    // Get secrets (backend-only, never exposed to frontend)
    const ISSUER_PRIVATE_KEY = Deno.env.get('ISSUER_PRIVATE_KEY');
    const NETWORK = Deno.env.get('NETWORK') || 'testnet';
    
    // Network configuration
    const RPC_URL = NETWORK === 'mainnet'
      ? (Deno.env.get('POLYGON_MAINNET_RPC_URL') || 'https://polygon-rpc.com')
      : (Deno.env.get('POLYGON_AMOY_RPC_URL') || 'https://rpc-amoy.polygon.technology');
    
    const CONTRACT_ADDRESS = NETWORK === 'mainnet'
      ? Deno.env.get('CONTRACT_ADDRESS_MAINNET')
      : Deno.env.get('CONTRACT_ADDRESS');

    if (!ISSUER_PRIVATE_KEY) {
      return Response.json({ error: 'ISSUER_PRIVATE_KEY not configured' }, { status: 500 });
    }

    if (!CONTRACT_ADDRESS) {
      return Response.json({ error: 'CONTRACT_ADDRESS not configured. Deploy contract first.' }, { status: 500 });
    }

    // Get student profile to retrieve wallet address
    const students = await base44.asServiceRole.entities.UserProfile.filter({ id: studentId });
    if (students.length === 0) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }
    const student = students[0];

    if (!student.wallet_address) {
      return Response.json({ error: 'Student does not have a wallet address' }, { status: 400 });
    }

    // Connect to Polygon (server-side only)
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(ISSUER_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, BLOCKWARD_ABI, signer);

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

    // For now, store metadata as data URI (in production: use IPFS)
    const metadataURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString('base64')}`;

    // Mint NFT on Polygon Amoy (backend signs transaction)
    console.log(`Minting BlockWard to ${student.wallet_address}...`);
    const tx = await contract.mint(student.wallet_address, metadataURI);
    
    console.log(`Transaction submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

    // Get token ID from contract
    const tokenId = await contract.tokenCounter();

    // Get current user (issuer)
    const issuer = await base44.auth.me();
    const issuerProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: issuer.email });
    const issuerProfile = issuerProfiles[0];

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

    return Response.json({
      success: true,
      txHash: receipt.hash,
      tokenId: tokenId.toString(),
      network: NETWORK === 'mainnet' ? 'polygon-mainnet' : 'polygon-amoy',
      explorerUrl: NETWORK === 'mainnet' 
        ? `https://polygonscan.com/tx/${receipt.hash}`
        : `https://amoy.polygonscan.com/tx/${receipt.hash}`,
      blockNumber: receipt.blockNumber
    });

  } catch (error) {
    console.error('❌ Error issuing BlockWard:', error);
    
    // Return user-friendly error
    return Response.json({ 
      error: 'Failed to issue BlockWard on blockchain',
      details: error.message 
    }, { status: 500 });
  }
});