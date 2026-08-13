// ⚠️ DORMANT — NOT part of the current canonical flow. On-chain minting is deferred.
// The canonical delivery path is sendToStudentVault (DB-backed BlockWard). This
// function is kept for future blockchain integration. Do not call from the UI.
// issueBlockward - canonical version, delegates to issueBlockwardV2 logic
// Soulbound NFT: minted directly to student via issueAward, no transfer needed
import { createPublicClient, createWalletClient, http, parseAbi, getAddress } from "npm:viem@2.7.0";
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";
import { sepolia, polygon } from "npm:viem@2.7.0/chains";
import { encodeBytes32String } from "npm:ethers@6.13.0";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

const ABI = parseAbi([
  "function issueAward(address studentVault, address teacherVault, bytes32 awardType_, string tokenURI_)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: CORS });

  const body = await req.json();
  const { studentId, title, category, description, tokenURI, imageUrl } = body;

  console.log(JSON.stringify({ fn: "issueBlockward", step: "START", studentId, title, category }));

  if (!studentId || !title || !category) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing studentId/title/category' }), { headers: CORS });
  }

  // ── ROLE ENFORCEMENT: caller must be an approved teacher ──
  const callerProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
  const callerProfile = callerProfiles?.[0];
  if (!callerProfile || callerProfile.user_type !== 'teacher') {
    return new Response(JSON.stringify({ ok: false, error: 'Only teachers can issue BlockWards' }), { status: 403, headers: CORS });
  }
  if (callerProfile.can_issue_blockwards !== true) {
    return new Response(JSON.stringify({ ok: false, error: 'You are not approved to issue BlockWards. Ask your admin to enable your permission.' }), { status: 403, headers: CORS });
  }

  const RPC = Deno.env.get("SEPOLIA_RPC_URL");
  const CONTRACT = Deno.env.get("CONTRACT_ADDRESS");
  const PK = Deno.env.get("ISSUER_PRIVATE_KEY");
  const NETWORK = Deno.env.get("NETWORK");

  if (!RPC || !CONTRACT || !PK) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing env vars' }), { headers: CORS });
  }
  // Only allow sepolia (testnet) and polygon (mainnet)
  if (NETWORK !== "sepolia" && NETWORK !== "polygon") {
    return new Response(JSON.stringify({ ok: false, error: `Unsupported network: "${NETWORK}". Set NETWORK to "sepolia" or "polygon".` }), { headers: CORS });
  }

  const account = privateKeyToAccount(PK);
  const teacherVault = account.address; // MUST equal msg.sender, which is the approved teacher

  console.log(JSON.stringify({ fn: "issueBlockward", step: "SIGNER", teacherVault }));

  // Resolve student address
  let studentAddr = body.studentAddress;
  if (!studentAddr) {
    const rows = await base44.asServiceRole.entities.UserProfile.filter({ id: studentId });
    if (!rows?.length) return new Response(JSON.stringify({ ok: false, error: 'Student not found' }), { headers: CORS });
    studentAddr = rows[0].wallet_address;
    if (!studentAddr) return new Response(JSON.stringify({ ok: false, error: 'Student has no wallet' }), { headers: CORS });
  }
  studentAddr = getAddress(studentAddr);

  console.log(JSON.stringify({ fn: "issueBlockward", step: "STUDENT", studentAddr }));

  // Build metadata URI
  const DEFAULT_IMAGE = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(title)}`;
  let uri = tokenURI;
  if (!uri) {
    const meta = {
      name: title,
      description: description || '',
      image: (imageUrl && imageUrl.trim()) ? imageUrl.trim() : DEFAULT_IMAGE,
      attributes: [
        { trait_type: 'Category', value: category },
      ]
    };
    uri = `data:application/json;base64,${btoa(unescape(encodeURIComponent(JSON.stringify(meta))))}`;
  }

  const awardBytes = encodeBytes32String(category);

  console.log(JSON.stringify({ fn: "issueBlockward", step: "ARGS", studentVault: studentAddr, teacherVault, awardType: awardBytes }));

  const chain = NETWORK === "polygon" ? polygon : sepolia;
  const pub = createPublicClient({ chain, transport: http(RPC) });
  const wal = createWalletClient({ account, chain, transport: http(RPC) });

  // Simulate issueAward
  let sim;
  try {
    sim = await pub.simulateContract({
      account, address: CONTRACT, abi: ABI,
      functionName: 'issueAward',
      args: [studentAddr, teacherVault, awardBytes, uri]
    });
    console.log(JSON.stringify({ fn: "issueBlockward", step: "SIM_OK" }));
  } catch (e) {
    console.log(JSON.stringify({ fn: "issueBlockward", step: "SIM_FAIL", err: e?.shortMessage || e?.message }));
    return new Response(JSON.stringify({
      ok: false,
      error: e?.shortMessage || e?.message,
      signerAddress: teacherVault,
      studentAddress: studentAddr,
      contract: CONTRACT
    }), { headers: CORS });
  }

  // Send tx
  const mintHash = await wal.writeContract(sim.request);
  console.log(JSON.stringify({ fn: "issueBlockward", step: "MINT_SENT", mintHash }));
  const mintReceipt = await pub.waitForTransactionReceipt({ hash: mintHash });
  console.log(JSON.stringify({ fn: "issueBlockward", step: "MINT_DONE", status: mintReceipt.status }));

  if (mintReceipt.status !== 'success') {
    return new Response(JSON.stringify({ ok: false, error: 'Mint reverted', mintHash }), { headers: CORS });
  }

  // Extract tokenId from Transfer event (topic[3] for indexed tokenId)
  let tokenId = null;
  const transferSig = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  for (const log of mintReceipt.logs) {
    if (log.topics[0]?.toLowerCase() === transferSig && log.topics.length === 4) {
      tokenId = BigInt(log.topics[3]);
      break;
    }
  }
  if (tokenId === null) {
    // Fallback: viem decodeEventLog
    for (const log of mintReceipt.logs) {
      try {
        const decoded = pub.decodeEventLog({ abi: ABI, data: log.data, topics: log.topics });
        if (decoded.eventName === 'Transfer') { tokenId = decoded.args.tokenId; break; }
      } catch {}
    }
  }

  console.log(JSON.stringify({ fn: "issueBlockward", step: "DONE", tokenId: tokenId?.toString() ?? null, studentAddr }));

  // Persist to BlockWard entity so it shows up in admin/teacher views
  const studentRows = await base44.asServiceRole.entities.UserProfile.filter({ id: body.studentId });
  const studentProfile = studentRows?.[0];
  const issuerProfile = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email }).then(r => r?.[0]);

  const blockwardRecord = {
    school_id: body.schoolId || studentProfile?.school_id || null,
    record_id: body.recordId || null,
    student_record_id: body.recordId || null,
    owner_student_id: body.studentId || null,
    owner_student_email: studentProfile?.user_email || null,
    owner_school_id: body.schoolId || studentProfile?.school_id || null,
    token_id: tokenId !== null ? tokenId.toString() : null,
    student_email: studentProfile?.user_email || null,
    student_name: studentProfile ? `${studentProfile.first_name} ${studentProfile.last_name}` : null,
    student_wallet: studentAddr,
    issuer_email: user.email,
    issuer_name: issuerProfile ? `${issuerProfile.first_name} ${issuerProfile.last_name}` : user.email,
    issuer_wallet: 'system',
    title,
    description: body.description || '',
    category: category.toLowerCase(),
    image_url: (imageUrl && imageUrl.trim()) ? imageUrl.trim() : DEFAULT_IMAGE,
    transaction_hash: mintReceipt.transactionHash,
    block_number: Number(mintReceipt.blockNumber),
    minted_at: new Date().toISOString(),
    vault_status: 'delivered',
    status: 'active'
  };

  let savedId = null;
  try {
    const saved = await base44.asServiceRole.entities.BlockWard.create(blockwardRecord);
    savedId = saved?.id || null;
    console.log(JSON.stringify({ fn: "issueBlockward", step: "DB_SAVED", id: savedId }));
  } catch (dbErr) {
    console.log(JSON.stringify({ fn: "issueBlockward", step: "DB_WARN", err: dbErr?.message }));
  }

  return new Response(JSON.stringify({
    ok: true,
    mintTxHash: mintReceipt.transactionHash,
    tokenId: tokenId !== null ? tokenId.toString() : null,
    studentAddress: studentAddr,
    signerAddress: teacherVault,
    blockwardId: savedId,
    title, category,
    blockNumber: mintReceipt.blockNumber.toString()
  }), { headers: CORS });
});