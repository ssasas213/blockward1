// Debug: confirm what address ISSUER_PRIVATE_KEY corresponds to, and check approval
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";
import { createPublicClient, http, parseAbi } from "npm:viem@2.7.0";
import { sepolia } from "npm:viem@2.7.0/chains";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const PK = Deno.env.get("ISSUER_PRIVATE_KEY");
  const RPC = Deno.env.get("SEPOLIA_RPC_URL");
  const CONTRACT = Deno.env.get("CONTRACT_ADDRESS");

  if (!PK) return new Response(JSON.stringify({ error: "ISSUER_PRIVATE_KEY not set" }), { headers: CORS });

  const account = privateKeyToAccount(PK);
  const signerAddress = account.address;

  // Check AccessControl TEACHER_ROLE for this address
  const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });

  let teacherRoleHash = null;
  let hasTeacherRole = null;

  try {
    teacherRoleHash = await pub.readContract({
      address: CONTRACT,
      abi: parseAbi(["function TEACHER_ROLE() view returns (bytes32)"]),
      functionName: "TEACHER_ROLE"
    });
    hasTeacherRole = await pub.readContract({
      address: CONTRACT,
      abi: parseAbi(["function hasRole(bytes32 role, address account) view returns (bool)"]),
      functionName: "hasRole",
      args: [teacherRoleHash, signerAddress]
    });
  } catch (e) {
    hasTeacherRole = "error: " + e.message;
  }

  // Also check using addTeacher mapping — try "approvedTeachers" and similar
  let mappingResult = null;
  try {
    mappingResult = await pub.readContract({
      address: CONTRACT,
      abi: parseAbi(["function approvedTeachers(address) view returns (bool)"]),
      functionName: "approvedTeachers",
      args: [signerAddress]
    });
  } catch {}

  return new Response(JSON.stringify({
    ISSUER_PRIVATE_KEY_address: signerAddress,
    CONTRACT: CONTRACT,
    hasTeacherRole,
    teacherRoleHash,
    mappingApprovedTeachers: mappingResult
  }), { headers: CORS });
});