import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createPublicClient, http } from 'npm:viem@2.7.0';
import { sepolia } from 'npm:viem@2.7.0/chains';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { txHash } = await req.json();

    if (!txHash) {
      return Response.json({ error: 'txHash required' }, { status: 400 });
    }

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(Deno.env.get('SEPOLIA_RPC_URL'))
    });

    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

      if (!receipt) {
        return Response.json({
          status: 'pending',
          message: 'Transaction not yet mined'
        });
      }

      const status = receipt.status === 'success' ? 'confirmed' : 'failed';

      // Extract tokenId from logs if confirmed
      let tokenId = null;
      if (status === 'confirmed' && receipt.logs.length > 0) {
        // Assuming Transfer event or similar - adjust based on your contract
        const transferLog = receipt.logs.find(log => log.topics.length > 0);
        if (transferLog && transferLog.topics[3]) {
          tokenId = parseInt(transferLog.topics[3], 16);
        }
      }

      return Response.json({
        status,
        blockNumber: receipt.blockNumber?.toString(),
        gasUsed: receipt.gasUsed?.toString(),
        tokenId
      });

    } catch (txError) {
      // Receipt not found
      return Response.json({
        status: 'pending',
        message: 'Receipt not available yet'
      });
    }

  } catch (error) {
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});