import { createPublicClient, createWalletClient, http, parseAbi, getAddress, encodeBytes32String } from "npm:viem@2.7.0";
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";
import { sepolia } from "npm:viem@2.7.0/chains";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

// The signer address derived from ISSUER_PRIVATE_KEY - must be approved via addTeacher()
// v2 - force redeploy
const APPROVED_SIGNER = "0xc07af63f5eaa6d67f4a618d00a8a502a61d5ff0e";

const CONTRACT_ABI = parseAbi([
  "function issueAward(address studentVault, address teacherVault, bytes32 awardType_, string tokenURI_)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
]);

Deno.serve(async (req) => {
  const debugId = "bw_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);

  const log = (msg, obj = {}) => {
    console.log(JSON.stringify({ debugId, message: msg, ...obj }));
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed', debugId }), { status: 405, headers: corsHeaders });
  }

  try {
    log("=== ISSUE BLOCKWARD START ===", { method: req.method });

    // Auth
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized', debugId }), { status: 401, headers: corsHeaders });
    }
    log("User authenticated", { email: user.email });

    // Parse body
    const body = await req.json();
    log("Request body received", { body });

    const { studentId, studentAddress: rawStudentAddress, title, category, description, tokenURI } = body;

    if (!studentId || !title || !category) {
      return new Response(JSON.stringify({ ok: false, code: 'MISSING_FIELDS', message: 'studentId, title, category are required', debugId }), { status: 200, headers: corsHeaders });
    }

    // Resolve student wallet address
    let studentAddress = rawStudentAddress;
    if (!studentAddress) {
      log("Loading student wallet from DB", { studentId });
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ id: studentId });
      if (!profiles || profiles.length === 0) {
        return new Response(JSON.stringify({ ok: false, code: 'STUDENT_NOT_FOUND', message: 'Student not found', studentId, debugId }), { status: 200, headers: corsHeaders });
      }
      studentAddress = profiles[0].wallet_address;
      if (!studentAddress) {
        return new Response(JSON.stringify({ ok: false, code: 'STUDENT_NO_WALLET', message: 'Student has no wallet address', studentId, debugId }), { status: 200, headers: corsHeaders });
      }
    }

    // Validate student address
    try {
      studentAddress = getAddress(studentAddress);
    } catch {
      return new Response(JSON.stringify({ ok: false, code: 'INVALID_STUDENT_ADDRESS', message: 'Invalid student address format', studentAddress, debugId }), { status: 200, headers: corsHeaders });
    }

    log("Student address resolved", { studentAddress });

    // Load env
    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    const contractAddress = Deno.env.get("CONTRACT_ADDRESS");
    const issuerPrivateKey = Deno.env.get("ISSUER_PRIVATE_KEY");
    const network = Deno.env.get("NETWORK");

    if (!rpcUrl || !contractAddress || !issuerPrivateKey) {
      return new Response(JSON.stringify({ ok: false, code: 'MISSING_CONFIG', message: 'SEPOLIA_RPC_URL, CONTRACT_ADDRESS, or ISSUER_PRIVATE_KEY not set', debugId }), { status: 200, headers: corsHeaders });
    }

    if (network !== "sepolia") {
      return new Response(JSON.stringify({ ok: false, code: 'UNSUPPORTED_NETWORK', message: `Network "${network}" not supported`, debugId }), { status: 200, headers: corsHeaders });
    }

    const rpcHost = new URL(rpcUrl).hostname;
    log("Environment loaded", { rpcHost, contractAddress, network });

    // Setup viem clients
    const account = privateKeyToAccount(issuerPrivateKey);

    if (account.address.toLowerCase() !== APPROVED_SIGNER) {
      log("CRITICAL: Signer mismatch", { expected: APPROVED_SIGNER, got: account.address });
      return new Response(JSON.stringify({ ok: false, code: 'WRONG_SIGNER', message: 'ISSUER_PRIVATE_KEY does not match the approved teacher signer', expected: APPROVED_SIGNER, got: account.address, debugId }), { status: 200, headers: corsHeaders });
    }

    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });

    const signerAddress = account.address;
    log("Signer confirmed", { signerAddress });

    // Build tokenURI
    let finalTokenURI = tokenURI;
    if (!finalTokenURI) {
      const metadata = {
        name: title,
        description: description || '',
        category,
        image: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(title)}`,
        attributes: [
          { trait_type: 'Category', value: category },
          { trait_type: 'Issued Date', value: new Date().toISOString() }
        ]
      };
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(metadata))));
      finalTokenURI = `data:application/json;base64,${b64}`;
    }

    const awardTypeBytes32 = encodeBytes32String(category);

    // issueAward: studentVault=student, teacherVault=signerAddress (MUST equal msg.sender)
    const mintArgs = [
      studentAddress,
      signerAddress,  // teacherVault MUST == msg.sender
      awardTypeBytes32,
      finalTokenURI
    ];

    log("Simulating issueAward...", { studentVault: mintArgs[0], teacherVault: mintArgs[1] });

    let simResult;
    try {
      simResult = await publicClient.simulateContract({
        account,
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'issueAward',
        args: mintArgs,
      });
      log("✓ issueAward simulation passed");
    } catch (e) {
      log("✗ issueAward simulation failed", { error: e?.shortMessage || e?.message });
      return new Response(JSON.stringify({
        ok: false,
        code: 'SIMULATION_FAILED',
        message: e?.shortMessage || e?.message || 'Simulation failed',
        debugId,
        hint: 'Make sure the signer has been approved via addTeacher() on the contract'
      }), { status: 200, headers: corsHeaders });
    }

    // Execute mint
    log("Sending issueAward transaction...");
    const mintTxHash = await walletClient.writeContract(simResult.request);
    log("Mint tx sent", { mintTxHash });

    const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintTxHash });
    log("Mint confirmed", { txHash: mintReceipt.transactionHash, status: mintReceipt.status, block: mintReceipt.blockNumber.toString() });

    if (mintReceipt.status !== 'success') {
      return new Response(JSON.stringify({ ok: false, code: 'MINT_REVERTED', message: 'Mint transaction reverted', mintTxHash: mintReceipt.transactionHash, debugId }), { status: 200, headers: corsHeaders });
    }

    // Extract tokenId
    let tokenId = null;
    for (const entry of mintReceipt.logs) {
      try {
        const decoded = publicClient.decodeEventLog({ abi: CONTRACT_ABI, data: entry.data, topics: entry.topics });
        if (decoded.eventName === 'Transfer') {
          tokenId = decoded.args.tokenId;
          log("TokenId extracted", { tokenId: tokenId.toString() });
          break;
        }
      } catch {}
    }

    if (tokenId === null) {
      return new Response(JSON.stringify({ ok: false, code: 'TOKEN_ID_NOT_FOUND', message: 'Minted but could not extract tokenId', mintTxHash: mintReceipt.transactionHash, debugId }), { status: 200, headers: corsHeaders });
    }

    // Transfer to student
    log("Simulating safeTransferFrom...", { from: signerAddress, to: studentAddress, tokenId: tokenId.toString() });

    let transferSim;
    try {
      transferSim = await publicClient.simulateContract({
        account,
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'safeTransferFrom',
        args: [signerAddress, studentAddress, tokenId],
      });
      log("✓ Transfer simulation passed");
    } catch (e) {
      log("✗ Transfer simulation failed", { error: e?.shortMessage || e?.message });
      return new Response(JSON.stringify({
        ok: false,
        code: 'TRANSFER_SIMULATION_FAILED',
        message: 'NFT minted but transfer to student failed: ' + (e?.shortMessage || e?.message),
        mintTxHash: mintReceipt.transactionHash,
        tokenId: tokenId.toString(),
        debugId
      }), { status: 200, headers: corsHeaders });
    }

    const transferTxHash = await walletClient.writeContract(transferSim.request);
    log("Transfer tx sent", { transferTxHash });

    const transferReceipt = await publicClient.waitForTransactionReceipt({ hash: transferTxHash });
    log("Transfer confirmed", { txHash: transferReceipt.transactionHash, status: transferReceipt.status });

    log("=== ✓ ISSUE BLOCKWARD SUCCESS ===");

    return new Response(JSON.stringify({
      ok: true,
      debugId,
      mintTxHash: mintReceipt.transactionHash,
      transferTxHash: transferReceipt.transactionHash,
      tokenId: tokenId.toString(),
      studentAddress,
      signerAddress,
      title,
      category,
      blockNumber: transferReceipt.blockNumber.toString(),
      status: transferReceipt.status
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error("ISSUE_BLOCKWARD_FATAL", { debugId, message: err?.message, code: err?.code, shortMessage: err?.shortMessage });
    return new Response(JSON.stringify({
      ok: false,
      debugId,
      message: err?.message ?? "Unknown error",
      shortMessage: err?.shortMessage,
      code: err?.code
    }), { status: 200, headers: corsHeaders });
  }
});