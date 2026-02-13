import { createPublicClient, createWalletClient, http, parseAbi } from "npm:viem@2.7.0";
import { privateKeyToAccount } from "npm:viem@2.7.0/accounts";
import { sepolia } from "npm:viem@2.7.0/chains";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
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

    // ADMIN AUTH: Check X-Admin-Key header
    const adminKeyHeader = req.headers.get('X-Admin-Key');
    const expectedAdminKey = Deno.env.get('ADMIN_KEY');
    
    if (!expectedAdminKey) {
      log("ADMIN_KEY not configured");
      return new Response(
        JSON.stringify({ ok: false, error: 'ADMIN_KEY not configured in secrets', debugId }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (adminKeyHeader !== expectedAdminKey) {
      log("Unauthorized - invalid or missing admin key");
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized', debugId }),
        { status: 401, headers: corsHeaders }
      );
    }

    log("Admin authenticated");

    // Parse body
    const body = await req.json();
    log("Request received", { teacherAddress: body.teacherAddress });

    const { teacherAddress } = body;

    if (!teacherAddress || !/^0x[a-fA-F0-9]{40}$/.test(teacherAddress)) {
      log("Invalid teacherAddress");
      return new Response(
        JSON.stringify({ 
          ok: false, 
          code: 'INVALID_ADDRESS',
          error: 'Invalid teacherAddress format', 
          debugId 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Load environment
    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    const contractAddress = Deno.env.get("CONTRACT_ADDRESS");
    const adminPrivateKey = Deno.env.get("ADMIN_PRIVATE_KEY");

    if (!rpcUrl) {
      log("SEPOLIA_RPC_URL not configured");
      return new Response(
        JSON.stringify({ ok: false, error: 'SEPOLIA_RPC_URL not configured', debugId }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!contractAddress) {
      log("CONTRACT_ADDRESS not configured");
      return new Response(
        JSON.stringify({ ok: false, error: 'CONTRACT_ADDRESS not configured', debugId }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!adminPrivateKey) {
      log("ADMIN_PRIVATE_KEY not configured");
      return new Response(
        JSON.stringify({ ok: false, error: 'ADMIN_PRIVATE_KEY not configured', debugId }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Validate ADMIN_PRIVATE_KEY format (0x + 64 hex chars)
    if (!/^0x[a-fA-F0-9]{64}$/.test(adminPrivateKey)) {
      log("ADMIN_PRIVATE_KEY invalid format", { length: adminPrivateKey?.length });
      return new Response(
        JSON.stringify({ 
          ok: false, 
          code: 'INVALID_ADMIN_PRIVATE_KEY',
          message: 'ADMIN_PRIVATE_KEY must be 0x + 64 hex chars', 
          debugId 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const rpcHost = new URL(rpcUrl).hostname;
    log("Environment loaded", { rpcHost, contractAddress });

    // Reject public RPC
    if (rpcHost === 'rpc.sepolia.org') {
      log("Public RPC detected");
      return new Response(
        JSON.stringify({ ok: false, error: 'SEPOLIA_RPC_URL must be Alchemy, not public RPC', debugId }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Setup viem clients
    log("Creating admin account...");
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
    log("adminSigner", { adminSigner });
    log("teacherAddress", { teacherAddress });

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
      log("✓ Simulation successful");
    } catch (simError: any) {
      log("✗ Simulation failed", {
        message: simError?.message,
        shortMessage: simError?.shortMessage,
        cause: simError?.cause
      });
      
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'SIMULATION_FAILED',
          error: 'Simulation failed',
          message: simError?.shortMessage || simError?.message,
          adminSigner,
          teacherAddress,
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
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString()
    });

    if (receipt.status !== 'success') {
      log("✗ Transaction reverted", { status: receipt.status });
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'TX_REVERTED',
          error: 'Transaction reverted',
          txHash: receipt.transactionHash,
          receiptStatus: receipt.status,
          debugId
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    log("=== ✓ APPROVE TEACHER SUCCESS ===");

    return new Response(
      JSON.stringify({
        ok: true,
        debugId,
        txHash: receipt.transactionHash,
        adminSigner,
        teacherAddress,
        receiptStatus: receipt.status,
        blockNumber: receipt.blockNumber.toString()
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("APPROVE_TEACHER_ERROR", JSON.stringify({
      debugId,
      error: err?.message,
      code: err?.code,
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