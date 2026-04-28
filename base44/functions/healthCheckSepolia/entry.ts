import { createPublicClient, http, parseAbi } from "npm:viem@2.7.0";
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";
import { sepolia } from "npm:viem@2.7.0/chains";

async function healthCheckSepolia() {
  try {
    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    const contract = Deno.env.get("CONTRACT_ADDRESS");
    const pk = Deno.env.get("ISSUER_PRIVATE_KEY");

    if (!rpcUrl || !contract || !pk) {
      return {
        ok: false,
        missing: {
          SEPOLIA_RPC_URL: !rpcUrl,
          CONTRACT_ADDRESS: !contract,
          ISSUER_PRIVATE_KEY: !pk,
        },
      };
    }

    const account = privateKeyToAccount(pk);

    const client = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const chainId = await client.getChainId();
    const bytecode = await client.getBytecode({ address: contract });

    const abi = parseAbi([
      "function PLATFORM_ROLE() view returns (bytes32)",
      "function hasRole(bytes32 role, address account) view returns (bool)",
    ]);

    if (!bytecode) {
      return {
        ok: false,
        chainId,
        issuerAddress: account.address,
        contractHasCode: false,
      };
    }

    const platformRole = await client.readContract({
      address: contract,
      abi,
      functionName: "PLATFORM_ROLE",
    });

    const issuerHasPlatformRole = await client.readContract({
      address: contract,
      abi,
      functionName: "hasRole",
      args: [platformRole, account.address],
    });

    return {
      ok: true,
      chainId,
      issuerAddress: account.address,
      contractHasCode: true,
      issuerHasPlatformRole,
    };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

Deno.serve(async () => {
  const result = await healthCheckSepolia();
  return Response.json(result);
});