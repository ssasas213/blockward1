// issueBlockwardV2 - clean slate, viem only
// teacherVault ALWAYS = signer address (ISSUER_PRIVATE_KEY derived address)
import { createPublicClient, createWalletClient, http, parseAbi, getAddress } from "npm:viem@2.7.0";
import { encodeBytes32String } from "npm:ethers@6.13.0";
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

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: CORS });

  const body = await req.json();
  const { studentId, title, category, description, tokenURI } = body;

  console.log(JSON.stringify({ fn: "issueBlockwardV2", step: "START", studentId, title, category }));

  if (!studentId || !title || !category) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing studentId/title/category' }), { headers: CORS });
  }

  const RPC = Deno.env.get("SEPOLIA_RPC_URL");
  const CONTRACT = Deno.env.get("CONTRACT_ADDRESS");
  const PK = Deno.env.get("ISSUER_PRIVATE_KEY");
  const NETWORK = Deno.env.get("NETWORK");

  if (!RPC || !CONTRACT || !PK) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing env vars' }), { headers: CORS });
  }
  if (NETWORK !== "sepolia") {
    return new Response(JSON.stringify({ ok: false, error: 'Wrong network: ' + NETWORK }), { headers: CORS });
  }

  // The signer IS the approved teacher on-chain
  const account = privateKeyToAccount(PK);
  const teacherVault = account.address; // teacherVault arg MUST == msg.sender

  console.log(JSON.stringify({ fn: "issueBlockwardV2", step: "SIGNER", teacherVault }));

  // Resolve student address
  let studentAddr = body.studentAddress;
  if (!studentAddr) {
    const rows = await base44.asServiceRole.entities.UserProfile.filter({ id: studentId });
    if (!rows?.length) return new Response(JSON.stringify({ ok: false, error: 'Student not found' }), { headers: CORS });
    studentAddr = rows[0].wallet_address;
    if (!studentAddr) return new Response(JSON.stringify({ ok: false, error: 'Student has no wallet' }), { headers: CORS });
  }
  studentAddr = getAddress(studentAddr);

  console.log(JSON.stringify({ fn: "issueBlockwardV2", step: "STUDENT", studentAddr }));

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

  console.log(JSON.stringify({ fn: "issueBlockwardV2", step: "ARGS", studentVault: studentAddr, teacherVault, awardType: awardBytes }));

  const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const wal = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

  // Simulate
  let sim;
  try {
    sim = await pub.simulateContract({
      account,
      address: CONTRACT,
      abi: ABI,
      functionName: 'issueAward',
      args: [studentAddr, teacherVault, awardBytes, uri]
    });
    console.log(JSON.stringify({ fn: "issueBlockwardV2", step: "SIM_OK" }));
  } catch (e) {
    console.log(JSON.stringify({ fn: "issueBlockwardV2", step: "SIM_FAIL", err: e?.shortMessage || e?.message }));
    return new Response(JSON.stringify({
      ok: false,
      fn: "issueBlockwardV2",
      error: e?.shortMessage || e?.message,
      signerAddress: teacherVault,
      studentAddress: studentAddr,
      contract: CONTRACT
    }), { headers: CORS });
  }

  // Mint
  const mintHash = await wal.writeContract(sim.request);
  console.log(JSON.stringify({ fn: "issueBlockwardV2", step: "MINT_SENT", mintHash }));
  const mintReceipt = await pub.waitForTransactionReceipt({ hash: mintHash });
  console.log(JSON.stringify({ fn: "issueBlockwardV2", step: "MINT_DONE", status: mintReceipt.status }));

  if (mintReceipt.status !== 'success') {
    return new Response(JSON.stringify({ ok: false, error: 'Mint reverted', mintHash }), { headers: CORS });
  }

  // Extract tokenId
  let tokenId = null;
  for (const log of mintReceipt.logs) {
    try {
      const decoded = pub.decodeEventLog({ abi: ABI, data: log.data, topics: log.topics });
      if (decoded.eventName === 'Transfer') { tokenId = decoded.args.tokenId; break; }
    } catch {}
  }
  if (tokenId === null) {
    return new Response(JSON.stringify({ ok: false, error: 'No tokenId in receipt', mintHash }), { headers: CORS });
  }
  console.log(JSON.stringify({ fn: "issueBlockwardV2", step: "TOKEN_ID", tokenId: tokenId.toString() }));

  // Transfer to student
  let tSim;
  try {
    tSim = await pub.simulateContract({
      account, address: CONTRACT, abi: ABI,
      functionName: 'safeTransferFrom',
      args: [teacherVault, studentAddr, tokenId]
    });
    console.log(JSON.stringify({ fn: "issueBlockwardV2", step: "TRANSFER_SIM_OK" }));
  } catch (e) {
    console.log(JSON.stringify({ fn: "issueBlockwardV2", step: "TRANSFER_SIM_FAIL", err: e?.shortMessage || e?.message }));
    return new Response(JSON.stringify({
      ok: false, error: 'Transfer sim failed: ' + (e?.shortMessage || e?.message),
      mintHash, tokenId: tokenId.toString()
    }), { headers: CORS });
  }

  const transferHash = await wal.writeContract(tSim.request);
  const transferReceipt = await pub.waitForTransactionReceipt({ hash: transferHash });
  console.log(JSON.stringify({ fn: "issueBlockwardV2", step: "DONE", transferStatus: transferReceipt.status }));

  return new Response(JSON.stringify({
    ok: true,
    fn: "issueBlockwardV2",
    mintTxHash: mintReceipt.transactionHash,
    transferTxHash: transferReceipt.transactionHash,
    tokenId: tokenId.toString(),
    studentAddress: studentAddr,
    signerAddress: teacherVault,
    title, category,
    blockNumber: transferReceipt.blockNumber.toString()
  }), { headers: CORS });
});