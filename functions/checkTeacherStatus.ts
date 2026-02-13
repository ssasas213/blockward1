import { createPublicClient, http, parseAbi, getAddress } from "npm:viem@2.7.0";
import { sepolia } from "npm:viem@2.7.0/chains";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'content-type': 'application/json'
};

const CONTRACT_ABI = parseAbi([
  "function isApprovedTeacher(address teacher) view returns (bool)"
]);

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const body = await req.json();
    const { teacherAddress } = body;

    if (!teacherAddress) {
      return Response.json({ ok: false, error: 'teacherAddress required' }, { headers: corsHeaders });
    }

    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    const contractAddress = Deno.env.get("CONTRACT_ADDRESS");

    if (!rpcUrl || !contractAddress) {
      return Response.json({ ok: false, error: 'RPC or contract not configured' }, { headers: corsHeaders });
    }

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const checksumAddress = getAddress(teacherAddress);

    const isApproved = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'isApprovedTeacher',
      args: [checksumAddress as `0x${string}`],
    });

    return Response.json({
      ok: true,
      teacherAddress: checksumAddress,
      isApproved,
      contractAddress,
    }, { headers: corsHeaders });

  } catch (err: any) {
    return Response.json({
      ok: false,
      error: err?.message || "Unknown error"
    }, { headers: corsHeaders });
  }
});