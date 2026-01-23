import { ethers } from 'npm:ethers@6.13.0';

/**
 * Health check for blockchain connectivity
 * Verifies RPC connection and issuer wallet setup
 */

Deno.serve(async (req) => {
  try {
    const RPC_URL = Deno.env.get('POLYGON_AMOY_RPC_URL');
    const ISSUER_PRIVATE_KEY = Deno.env.get('ISSUER_PRIVATE_KEY');

    if (!RPC_URL || !ISSUER_PRIVATE_KEY) {
      return Response.json({ 
        error: 'Missing configuration', 
        has_rpc: !!RPC_URL, 
        has_key: !!ISSUER_PRIVATE_KEY 
      }, { status: 500 });
    }

    // Connect to Polygon Amoy
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ISSUER_PRIVATE_KEY);
    const address = wallet.address;

    // Get network info and balance
    const [network, balance] = await Promise.all([
      provider.getNetwork(),
      provider.getBalance(address)
    ]);

    const chainId = Number(network.chainId);
    const balanceEth = ethers.formatEther(balance);

    console.log(`✅ Connected to chain ${chainId}, address ${address}, balance ${balanceEth} MATIC`);

    return Response.json({
      success: true,
      address,
      balance: balanceEth,
      chainId,
      network: chainId === 80002 ? 'polygon-amoy' : 'unknown',
      rpcUrl: RPC_URL.substring(0, 30) + '...'
    });

  } catch (error) {
    console.error('Health check failed:', error);
    return Response.json({ 
      error: 'Health check failed', 
      details: error.message 
    }, { status: 500 });
  }
});