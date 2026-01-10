import { ethers } from 'ethers';

/**
 * Helper function to deploy the BlockWard smart contract
 * Run this once to deploy contract to Polygon Amoy
 * Then set CONTRACT_ADDRESS secret with the deployed address
 */

const BLOCKWARD_CONTRACT_BYTECODE = "YOUR_CONTRACT_BYTECODE_HERE";

const BLOCKWARD_ABI = [
  "constructor(string memory name, string memory symbol)",
  "function mint(address to, string memory uri) public returns (uint256)",
  "function tokenCounter() public view returns (uint256)"
];

export default async function deployContract(request, context) {
  const ISSUER_PRIVATE_KEY = context.secrets.ISSUER_PRIVATE_KEY;
  const NETWORK = request.body?.network || context.secrets.NETWORK || 'testnet'; // 'testnet' or 'mainnet'
  
  // Network configuration
  const RPC_URL = NETWORK === 'mainnet'
    ? (context.secrets.POLYGON_MAINNET_RPC_URL || 'https://polygon-rpc.com')
    : (context.secrets.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology');

  if (!ISSUER_PRIVATE_KEY) {
    return {
      status: 500,
      body: { error: 'ISSUER_PRIVATE_KEY not configured' }
    };
  }

  // Mainnet safety check
  if (NETWORK === 'mainnet') {
    console.warn('⚠️  DEPLOYING TO POLYGON MAINNET - THIS WILL USE REAL MATIC!');
    if (!request.body?.confirmMainnet) {
      return {
        status: 400,
        body: { 
          error: 'Mainnet deployment requires explicit confirmation',
          message: 'Set confirmMainnet: true in request body to deploy to mainnet'
        }
      };
    }
  }

  try {
    // Connect to Polygon Amoy
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(ISSUER_PRIVATE_KEY, provider);

    console.log('Deploying contract from:', signer.address);

    // Check balance
    const balance = await provider.getBalance(signer.address);
    console.log('Deployer balance:', ethers.formatEther(balance), 'MATIC');

    if (balance === 0n) {
      return {
        status: 400,
        body: { 
          error: NETWORK === 'mainnet'
            ? 'Deployer wallet has no MATIC. Fund wallet with real MATIC from an exchange.'
            : 'Deployer wallet has no MATIC. Get testnet MATIC from: https://faucet.polygon.technology/'
        }
      };
    }

    // Deploy contract
    const factory = new ethers.ContractFactory(BLOCKWARD_ABI, BLOCKWARD_CONTRACT_BYTECODE, signer);
    const contract = await factory.deploy("BlockWard", "BLKWRD");
    
    console.log('Contract deployment transaction:', contract.deploymentTransaction().hash);
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    console.log('Contract deployed at:', contractAddress);

    return {
      status: 200,
      body: {
        success: true,
        contractAddress: contractAddress,
        message: NETWORK === 'mainnet' 
          ? 'Now set CONTRACT_ADDRESS_MAINNET secret to: ' + contractAddress
          : 'Now set CONTRACT_ADDRESS secret to: ' + contractAddress,
        network: NETWORK === 'mainnet' ? 'polygon-mainnet' : 'polygon-amoy',
        explorerUrl: NETWORK === 'mainnet'
          ? `https://polygonscan.com/address/${contractAddress}`
          : `https://amoy.polygonscan.com/address/${contractAddress}`
      }
    };

  } catch (error) {
    console.error('Deployment error:', error);
    return {
      status: 500,
      body: { 
        error: 'Contract deployment failed',
        details: error.message 
      }
    };
  }
}