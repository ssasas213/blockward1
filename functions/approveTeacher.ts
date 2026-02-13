import { createPublicClient, createWalletClient, http, parseAbi } from "npm:viem@2.7.0";
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";
import { sepolia } from "npm:viem@2.7.0/chains";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

const CONTRACT_ABI = parseAbi([
  "function addTeacher(address teacher)"
]);

Deno.serve(async (req) => {
  const debugId = `AT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const log = (msg: string, obj = {}) => {
    console.log(JSON.stringify({ msg, debugId, ...obj }));
  };

  try {
    log("=== APPROVE TEACHER START ===", { method: req.method });

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Method not allowed', debugId }),
        { status: 405, headers: corsHeaders }
      );
    }

    const body = await req.json();
    log("Request received", { teacherAddress: body.teacherAddress });

    const { teacherAddress } = body;

    if (!teacherAddress || !/^0x[a-fA-F0-9]{40}$/.test(teacherAddress)) {
      log("Invalid teacherAddress");
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid teacherAddress', debugId }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Load environment
    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    const contractAddress = Deno.env.get("CONTRACT_ADDRESS");
    const adminPrivateKey = Deno.env.get("ADMIN_PRIVATE_KEY");

    if (!rpcUrl || !contractAddress || !adminPrivateKey) {
      log("Missing environment variables");
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing env configuration', debugId }),
        { status: 500, headers: corsHeaders }
      );
    }

    const rpcHost = new URL(rpcUrl).hostname;
    log("Environment loaded", { rpcHost, contractAddress });

    // Setup viem clients
    const account = privateKeyToAccount(adminPrivateKey as `0x${string}`);
    
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const adminSigner = account.address;
    log("Admin signer", { adminSigner });

    // Simulate transaction
    log("Simulating addTeacher...");
    let simulationResult;
    
    try {
      simulationResult = await publicClient.simulateContract({
        account,
        address: contractAddress as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'addTeacher',
        args: [teacherAddress as `0x${string}`],
      });
      log("Simulation successful");
    } catch (simError: any) {
      log("Simulation failed", {
        message: simError?.message,
        shortMessage: simError?.shortMessage
      });
      
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Simulation failed',
          message: simError?.shortMessage || simError?.message,
          debugId
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Execute transaction
    log("Executing addTeacher...");
    const txHash = await walletClient.writeContract(simulationResult.request);
    log("Transaction sent", { txHash });

    // Wait for confirmation
    log("Waiting for receipt...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    
    log("Transaction confirmed", {
      txHash: receipt.transactionHash,
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString()
    });

    log("=== APPROVE TEACHER SUCCESS ===");

    return new Response(
      JSON.stringify({
        ok: true,
        txHash: receipt.transactionHash,
        adminSigner,
        teacherAddress,
        receiptStatus: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
        debugId
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("APPROVE_TEACHER_ERROR", JSON.stringify({
      debugId,
      error: err?.message,
      stack: err?.stack
    }, null, 2));

    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || "Unknown error",
        debugId
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});