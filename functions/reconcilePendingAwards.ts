import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createPublicClient, http } from 'npm:viem@2.7.0';
import { sepolia } from 'npm:viem@2.7.0/chains';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This function should be called by admin or scheduled task
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(Deno.env.get('SEPOLIA_RPC_URL'))
    });

    // Find pending/submitted awards
    const pendingAwards = await base44.asServiceRole.entities.AwardIssues.filter({
      chain_status: 'submitted'
    });

    const results = {
      total: pendingAwards.length,
      confirmed: 0,
      failed: 0,
      stillPending: 0,
      errors: []
    };

    for (const award of pendingAwards) {
      if (!award.tx_hash) {
        results.errors.push({ id: award.id, error: 'No tx_hash' });
        continue;
      }

      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: award.tx_hash });

        if (!receipt) {
          // Still pending
          results.stillPending++;
          await base44.asServiceRole.entities.AwardIssues.update(award.id, {
            chain_status: 'pending'
          });
          continue;
        }

        if (receipt.status === 'success') {
          // Confirmed - extract tokenId
          let tokenId = null;
          if (receipt.logs.length > 0) {
            const transferLog = receipt.logs.find(log => log.topics.length > 0);
            if (transferLog && transferLog.topics[3]) {
              tokenId = parseInt(transferLog.topics[3], 16);
            }
          }

          await base44.asServiceRole.entities.AwardIssues.update(award.id, {
            chain_status: 'confirmed',
            token_id: tokenId
          });
          results.confirmed++;

        } else {
          // Failed
          await base44.asServiceRole.entities.AwardIssues.update(award.id, {
            chain_status: 'failed',
            error_message: 'Transaction reverted'
          });
          results.failed++;
        }

      } catch (error) {
        results.errors.push({ id: award.id, error: error.message });
      }
    }

    return Response.json({
      success: true,
      results
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});