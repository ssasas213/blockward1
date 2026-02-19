// issueBlockward v6 - force redeploy, viem only, no ethers
import { createPublicClient, createWalletClient, http, parseAbi, getAddress, encodeBytes32String } from "npm:viem@2.7.0";
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";
import { sepolia } from "npm:viem@2.7.0/chains";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

const ABI = parseAbi([
  "function issueAward(address studentVault, address teacherVault, bytes32 awardType_, string tokenURI_)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const id = "bw_v6_" + Date.now();
  const L = (m, o = {}) => console.log(JSON.stringify({ id, m, ...o }));

  L("V6_START");

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: CORS });

  const body = await req.json();
  const { studentId, title, category, description, tokenURI } = body;

  L("BODY", { studentId, title, category, hasStudentAddr: !!body.studentAddress });

  if (!studentId || !title || !category) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing studentId/title/category' }), { headers: CORS });
  }

  // Load env
  const RPC = Deno.env.get("SEPOLIA_RPC_URL");
  const CONTRACT = Deno.env.get("CONTRACT_ADDRESS");
  const PK = Deno.env.get("ISSUER_PRIVATE_KEY");
  const NETWORK = Deno.env.get("NETWORK");

  L("ENV", { rpcSet: !!RPC, contractSet: !!CONTRACT, pkSet: !!PK, network: NETWORK });

  if (!RPC || !CONTRACT || !PK) return new Response(JSON.stringify({ ok: false, error: 'Missing env vars' }), { headers: CORS });
  if (NETWORK !== "sepolia") return new Response(JSON.stringify({ ok: false, error: 'Not sepolia, got: ' + NETWORK }), { headers: CORS });

  // Signer = ISSUER_PRIVATE_KEY — this MUST be the approved teacher on-chain
  const account = privateKeyToAccount(PK);
  L("SIGNER", { signerAddress: account.address });

  // Resolve student address
  let studentAddr = body.studentAddress;
  if (!studentAddr) {
    const rows = await base44.asServiceRole.entities.UserProfile.filter({ id: studentId });
    if (!rows?.length) return new Response(JSON.stringify({ ok: false, error: 'Student not found' }), { headers: CORS });
    studentAddr = rows[0].wallet_address;
    if (!studentAddr) return new Response(JSON.stringify({ ok: false, error: 'Student has no wallet' }), { headers: CORS });
  }
  try { studentAddr = getAddress(studentAddr); } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid student address' }), { headers: CORS });
  }

  L("STUDENT", { studentAddr });

  const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const wal = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

  // Build metadata URI
  let uri = tokenURI;
  if (!uri) {
    const meta = {
      name: title,
      description: description || '',
      category,
      image: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(title)}`
    };
    uri = `data:application/json;base64,${btoa(unescape(encodeURIComponent(JSON.stringify(meta))))}`;
  }

  const awardBytes = encodeBytes32String(category);

  // CRITICAL: teacherVault arg MUST equal account.address (msg.sender)
  // The contract checks: require(approvedTeachers[teacherVault] && msg.sender == teacherVault)
  const issueArgs = [studentAddr, account.address, awardBytes, uri];
  L("ISSUE_ARGS", {
    studentVault: issueArgs[0],
    teacherVault: issueArgs[1],
    awardType: issueArgs[2],
    uriPreview: uri.slice(0, 80)
  });

  // Simulate issueAward
  let sim;
  try {
    sim = await pub.simulateContract({
      account,
      address: CONTRACT,
      abi: ABI,
      functionName: 'issueAward',
      args: issueArgs
    });
    L("SIM_OK");
  } catch (e) {
    L("SIM_FAIL", { err: e?.shortMessage || e?.message });
    return new Response(JSON.stringify({
      ok: false,
      error: 'Simulation failed: ' + (e?.shortMessage || e?.message),
      signerAddress: account.address,
      teacherVaultArg: account.address,
      studentVaultArg: studentAddr,
      id
    }), { headers: CORS });
  }

  // Send mint tx
  const mintHash = await wal.writeContract(sim.request);
  L("MINT_TX", { mintHash });
  const mintReceipt = await pub.waitForTransactionReceipt({ hash: mintHash });
  L("MINT_RECEIPT", { status: mintReceipt.status, block: mintReceipt.blockNumber.toString() });

  if (mintReceipt.status !== 'success') {
    return new Response(JSON.stringify({ ok: false, error: 'Mint tx reverted', mintHash, id }), { headers: CORS });
  }

  // Extract tokenId from Transfer event
  let tokenId = null;
  for (const log of mintReceipt.logs) {
    try {
      const decoded = pub.decodeEventLog({ abi: ABI, data: log.data, topics: log.topics });
      if (decoded.eventName === 'Transfer') {
        tokenId = decoded.args.tokenId;
        break;
      }
    } catch {}
  }

  if (tokenId === null) {
    return new Response(JSON.stringify({ ok: false, error: 'Cannot extract tokenId from mint receipt', mintHash, id }), { headers: CORS });
  }
  L("TOKEN_ID", { tokenId: tokenId.toString() });

  // Transfer NFT to student wallet
  let tSim;
  try {
    tSim = await pub.simulateContract({
      account,
      address: CONTRACT,
      abi: ABI,
      functionName: 'safeTransferFrom',
      args: [account.address, studentAddr, tokenId]
    });
    L("TRANSFER_SIM_OK");
  } catch (e) {
    L("TRANSFER_SIM_FAIL", { err: e?.shortMessage || e?.message });
    return new Response(JSON.stringify({
      ok: false,
      error: 'Transfer simulation failed: ' + (e?.shortMessage || e?.message),
      mintHash,
      tokenId: tokenId.toString(),
      id
    }), { headers: CORS });
  }

  const transferHash = await wal.writeContract(tSim.request);
  L("TRANSFER_TX", { transferHash });
  const transferReceipt = await pub.waitForTransactionReceipt({ hash: transferHash });
  L("TRANSFER_RECEIPT", { status: transferReceipt.status });

  L("V6_SUCCESS");
  return new Response(JSON.stringify({
    ok: true,
    id,
    version: 'v6',
    mintTxHash: mintReceipt.transactionHash,
    transferTxHash: transferReceipt.transactionHash,
    tokenId: tokenId.toString(),
    studentAddress: studentAddr,
    signerAddress: account.address,
    title,
    category,
    blockNumber: transferReceipt.blockNumber.toString()
  }), { headers: CORS });
});