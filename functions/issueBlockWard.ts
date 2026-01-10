import { ethers } from 'ethers';

// Soulbound ERC-721 Smart Contract ABI
const BLOCKWARD_ABI = [
  "function mint(address to, string memory uri) public returns (uint256)",
  "function tokenCounter() public view returns (uint256)",
  "function balanceOf(address owner) public view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) public view returns (uint256)"
];

/**
 * Issue a BlockWard NFT on Polygon Amoy testnet
 * All blockchain operations happen server-side
 * Frontend never touches private keys
 */
export default async function issueBlockWard(request, context) {
  const { studentId, title, category, description } = request.body;

  // Validate required fields
  if (!studentId || !title || !category) {
    return {
      status: 400,
      body: { error: 'Missing required fields: studentId, title, category' }
    };
  }

  // Get secrets (backend-only, never exposed to frontend)
  const ISSUER_PRIVATE_KEY = context.secrets.ISSUER_PRIVATE_KEY;
  const NETWORK = context.secrets.NETWORK || 'testnet'; // 'testnet' or 'mainnet'
  
  // Network configuration
  const RPC_URL = NETWORK === 'mainnet'
    ? (context.secrets.POLYGON_MAINNET_RPC_URL || 'https://polygon-rpc.com')
    : (context.secrets.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology');
  
  const CONTRACT_ADDRESS = NETWORK === 'mainnet'
    ? context.secrets.CONTRACT_ADDRESS_MAINNET
    : context.secrets.CONTRACT_ADDRESS;

  if (!ISSUER_PRIVATE_KEY) {
    return {
      status: 500,
      body: { error: 'ISSUER_PRIVATE_KEY not configured' }
    };
  }

  if (!CONTRACT_ADDRESS) {
    return {
      status: 500,
      body: { error: 'CONTRACT_ADDRESS not configured. Deploy contract first.' }
    };
  }

  try {
    // Get student profile to retrieve wallet address
    const students = await context.entities.UserProfile.filter({ id: studentId });
    if (students.length === 0) {
      return {
        status: 404,
        body: { error: 'Student not found' }
      };
    }
    const student = students[0];

    if (!student.wallet_address) {
      return {
        status: 400,
        body: { error: 'Student does not have a wallet address' }
      };
    }

    // Connect to Polygon Amoy (server-side only)
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
    const issuer = await context.auth.me();
    const issuerProfiles = await context.entities.UserProfile.filter({ user_email: issuer.email });
    const issuerProfile = issuerProfiles[0];

    // Save BlockWard record to database
    await context.entities.BlockWard.create({
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

    return {
      status: 200,
      body: {
        success: true,
        txHash: receipt.hash,
        tokenId: tokenId.toString(),
        network: NETWORK === 'mainnet' ? 'polygon-mainnet' : 'polygon-amoy',
        explorerUrl: NETWORK === 'mainnet' 
          ? `https://polygonscan.com/tx/${receipt.hash}`
          : `https://amoy.polygonscan.com/tx/${receipt.hash}`,
        blockNumber: receipt.blockNumber
      }
    };

  } catch (error) {
    console.error('Error issuing BlockWard:', error);
    
    // Return user-friendly error
    return {
      status: 500,
      body: { 
        error: 'Failed to issue BlockWard on blockchain',
        details: error.message 
      }
    };
  }
}