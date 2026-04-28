import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createWalletClient, http, createPublicClient, keccak256, toBytes } from 'npm:viem@2.7.0';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';
import { sepolia } from 'npm:viem@2.7.0/chains';

const AWARD_CONTRACT_ABI = [
  {
    "inputs": [
      { "name": "studentVault", "type": "address" },
      { "name": "teacherVault", "type": "address" },
      { "name": "awardTypeBytes32", "type": "bytes32" },
      { "name": "tokenURI", "type": "string" }
    ],
    "name": "issueAward",
    "outputs": [{ "name": "tokenId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - admin only' }, { status: 401 });
    }

    const { teacherUserId, studentUserId, awardTypeCode, tokenURI } = await req.json();

    if (!teacherUserId || !studentUserId || !awardTypeCode || !tokenURI) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch teacher vault
    const teacherVaults = await base44.asServiceRole.entities.Vaults.filter({ user_id: teacherUserId });
    if (teacherVaults.length === 0) {
      return Response.json({ error: 'Teacher vault not found' }, { status: 404 });
    }
    const teacherVault = teacherVaults[0];

    // Fetch student vault
    const studentVaults = await base44.asServiceRole.entities.Vaults.filter({ user_id: studentUserId });
    if (studentVaults.length === 0) {
      return Response.json({ error: 'Student vault not found' }, { status: 404 });
    }
    const studentVault = studentVaults[0];

    // Fetch award type
    const awardTypes = await base44.asServiceRole.entities.AwardTypes.filter({ code: awardTypeCode });
    if (awardTypes.length === 0) {
      return Response.json({ error: 'Award type not found' }, { status: 404 });
    }
    const awardType = awardTypes[0];

    // Compute bytes32 hash
    const awardTypeBytes32 = keccak256(toBytes(awardTypeCode));

    // Create AwardIssues record with status "created"
    const contractAddress = Deno.env.get('CONTRACT_ADDRESS');
    const awardIssue = await base44.asServiceRole.entities.AwardIssues.create({
      award_type_id: awardType.id,
      issued_by_teacher_user_id: teacherUserId,
      student_user_id: studentUserId,
      teacher_vault_address: teacherVault.address,
      student_vault_address: studentVault.address,
      token_uri: tokenURI,
      award_type_bytes32: awardTypeBytes32,
      network: 'sepolia',
      contract_address: contractAddress,
      chain_status: 'created'
    });

    // Setup wallet client with issuer private key
    const issuerPrivateKey = Deno.env.get('ISSUER_PRIVATE_KEY');
    const account = privateKeyToAccount(issuerPrivateKey);

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(Deno.env.get('SEPOLIA_RPC_URL'))
    });

    try {
      // Submit transaction (DO NOT WAIT FOR CONFIRMATION)
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: AWARD_CONTRACT_ABI,
        functionName: 'issueAward',
        args: [studentVault.address, teacherVault.address, awardTypeBytes32, tokenURI]
      });

      // Immediately update with txHash and status "submitted"
      await base44.asServiceRole.entities.AwardIssues.update(awardIssue.id, {
        tx_hash: txHash,
        chain_status: 'submitted'
      });

      return Response.json({
        success: true,
        awardIssueId: awardIssue.id,
        txHash,
        message: 'Award transaction submitted. Check status later.'
      });

    } catch (txError) {
      // Transaction failed to submit
      await base44.asServiceRole.entities.AwardIssues.update(awardIssue.id, {
        chain_status: 'failed',
        error_message: txError.message
      });

      return Response.json({
        success: false,
        error: 'Transaction submission failed',
        details: txError.message,
        awardIssueId: awardIssue.id
      }, { status: 500 });
    }

  } catch (error) {
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});