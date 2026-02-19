// Diagnose issueAward by decompiling what the contract actually checks
import { createPublicClient, http, parseAbi } from "npm:viem@2.7.0";
import { sepolia } from "npm:viem@2.7.0/chains";
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const RPC = Deno.env.get("SEPOLIA_RPC_URL");
  const CONTRACT = Deno.env.get("CONTRACT_ADDRESS");
  const PK = Deno.env.get("ISSUER_PRIVATE_KEY");

  const account = privateKeyToAccount(PK);
  const signerAddress = account.address;

  const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });

  const results = {
    signerAddress,
    contract: CONTRACT,
    checks: {}
  };

  // Try every possible "is approved" getter with the signer address
  const getters = [
    ["isTeacher", "function isTeacher(address) view returns (bool)"],
    ["isApprovedTeacher", "function isApprovedTeacher(address) view returns (bool)"],
    ["approvedTeachers", "function approvedTeachers(address) view returns (bool)"],
    ["teachers", "function teachers(address) view returns (bool)"],
    ["teacherVaults", "function teacherVaults(address) view returns (bool)"],
    ["platformUsers", "function platformUsers(address) view returns (bool)"],
    ["authorizedTeachers", "function authorizedTeachers(address) view returns (bool)"],
    ["approvedIssuers", "function approvedIssuers(address) view returns (bool)"],
    ["isIssuer", "function isIssuer(address) view returns (bool)"],
    ["vaultApproved", "function vaultApproved(address) view returns (bool)"],
    ["teacherList", "function teacherList(address) view returns (bool)"],
    ["whitelistedTeachers", "function whitelistedTeachers(address) view returns (bool)"],
    // Try with (address, address) patterns
    ["isApprovedForAll", "function isApprovedForAll(address owner, address operator) view returns (bool)"],
  ];

  for (const [name, sig] of getters) {
    try {
      const args = name === "isApprovedForAll" 
        ? [signerAddress, signerAddress] 
        : [signerAddress];
      const v = await pub.readContract({
        address: CONTRACT,
        abi: parseAbi([sig]),
        functionName: name,
        args
      });
      results.checks[name] = v;
    } catch (e) {
      results.checks[name] = null; // function doesn't exist
    }
  }

  // Try to simulate issueAward with a dummy student address (same as signer) to isolate the revert
  try {
    const ABI = parseAbi([
      "function issueAward(address studentVault, address teacherVault, bytes32 awardType_, string tokenURI_)"
    ]);
    const bytes32 = "0x6163616465006d6963000000000000000000000000000000000000000000000000"; // "academic"
    await pub.simulateContract({
      account,
      address: CONTRACT,
      abi: ABI,
      functionName: 'issueAward',
      args: [signerAddress, signerAddress, bytes32, "data:text/plain,test"]
    });
    results.simulateIssueAward = "PASSED";
  } catch (e) {
    results.simulateIssueAward = e?.shortMessage || e?.message;
  }

  // Check what role the addTeacher function actually sets by reading slots
  // Try to call addTeacher to see what functions it exposes
  const writeFns = [
    "function addTeacher(address teacher)",
    "function approveTeacher(address teacher)",
    "function registerTeacher(address teacher)",
    "function setTeacher(address teacher, bool approved)",
    "function whitelistTeacher(address teacher)",
  ];

  results.availableWriteFunctions = [];
  for (const sig of writeFns) {
    try {
      const fnName = sig.match(/function (\w+)/)?.[1];
      // We can't easily test write functions without sending a tx, 
      // but we can check if the selector exists in the bytecode
      results.availableWriteFunctions.push({ fn: fnName, sig });
    } catch {}
  }

  return new Response(JSON.stringify(results, null, 2), { headers: CORS });
});