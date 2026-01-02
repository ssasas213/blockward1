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
  const RPC_URL = context.secrets.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology';

  if (!ISSUER_PRIVATE_KEY) {
    return {
      status: 500,
      body: { error: 'ISSUER_PRIVATE_KEY not configured' }
    };
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
          error: 'Deployer wallet has no MATIC. Get testnet MATIC from: https://faucet.polygon.technology/' 
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
        message: 'Now set CONTRACT_ADDRESS secret to: ' + contractAddress,
        network: 'polygon-amoy'
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