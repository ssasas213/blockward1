// ⚠️ DORMANT — NOT part of the current canonical flow. On-chain reconcile/verify
// is deferred until blockchain minting is wired. Kept for future use.
// reconcileBlockWards - scans all BlockWard records, verifies tx on Sepolia, repairs status
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createPublicClient, http } from 'npm:viem@2.7.0';
import { sepolia } from 'npm:viem@2.7.0/chains';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const RPC = Deno.env.get('SEPOLIA_RPC_URL');
  if (!RPC) return Response.json({ error: 'SEPOLIA_RPC_URL not set' }, { status: 500 });

  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });

  // Load all BlockWard records
  const allBlockWards = await base44.asServiceRole.entities.BlockWard.list();
  console.log(`reconcileBlockWards: scanning ${allBlockWards.length} records`);

  const results = { total: allBlockWards.length, repaired: 0, failed: 0, pending: 0, alreadyCorrect: 0, noTx: 0 };

  for (const bw of allBlockWards) {
    // Already active with a tx hash — verify on chain
    if (bw.transaction_hash) {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: bw.transaction_hash });
        if (!receipt) {
          // Still pending on chain
          results.pending++;
          continue;
        }
        if (receipt.status === 'success') {
          // Check if our DB record is correct
          const updates = {};
          if (bw.status !== 'active') updates.status = 'active';
          if (!bw.block_number) updates.block_number = Number(receipt.blockNumber);

          // Extract tokenId if missing
          if (!bw.token_id) {
            const transferSig = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
            for (const log of receipt.logs) {
              if (log.topics[0]?.toLowerCase() === transferSig && log.topics.length === 4) {
                updates.token_id = BigInt(log.topics[3]).toString();
                break;
              }
            }
          }

          if (Object.keys(updates).length > 0) {
            await base44.asServiceRole.entities.BlockWard.update(bw.id, updates);
            results.repaired++;
            console.log(`repaired ${bw.id}: ${JSON.stringify(updates)}`);
          } else {
            results.alreadyCorrect++;
          }
        } else {
          // Tx failed on chain — mark failed
          if (bw.status !== 'revoked') {
            await base44.asServiceRole.entities.BlockWard.update(bw.id, { status: 'revoked', revoke_reason: 'Transaction failed on-chain' });
            results.failed++;
          }
        }
      } catch (err) {
        console.log(`error checking ${bw.id}: ${err.message}`);
        results.failed++;
      }
    } else {
      // No tx hash — record was created without blockchain (e.g. from admin quick-issue dialog)
      // Ensure status is active
      if (bw.status !== 'active' && bw.status !== 'revoked') {
        await base44.asServiceRole.entities.BlockWard.update(bw.id, { status: 'active' });
        results.repaired++;
      }
      results.noTx++;
    }
  }

  console.log(`reconcileBlockWards done: ${JSON.stringify(results)}`);
  return Response.json({ success: true, results });
});