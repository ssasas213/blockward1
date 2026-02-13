import { createWalletClient, http, parseAbi } from "npm:viem@2.7.0";
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";
import { sepolia } from "npm:viem@2.7.0/chains";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { studentVault, teacherVault, awardType, tokenURI } = await req.json();

    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    const contract = Deno.env.get("CONTRACT_ADDRESS");
    const pk = Deno.env.get("ISSUER_PRIVATE_KEY");

    if (!studentVault || !teacherVault || !awardType || !tokenURI) {
      return Response.json({ ok: false, error: "Missing parameters" }, { status: 400 });
    }

    const account = privateKeyToAccount(pk);

    const client = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const abi = parseAbi([
      "function issueAward(address studentVault,address teacherVault,bytes32 awardType_,string tokenURI_)"
    ]);

    const hash = await client.writeContract({
      address: contract,
      abi,
      functionName: "issueAward",
      args: [studentVault, teacherVault, awardType, tokenURI],
    });

    return Response.json({ ok: true, txHash: hash });

  } catch (e) {
    return Response.json({
      ok: false,
      error: String(e?.message || e),
    }, { status: 500 });
  }
});