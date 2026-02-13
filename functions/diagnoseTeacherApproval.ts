import { createPublicClient, http, parseAbi } from "npm:viem@2.7.0";
import { sepolia } from "npm:viem@2.7.0/chains";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  const debugId = `DTA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const log = (msg: string, obj = {}) => {
    console.log(JSON.stringify({ msg, debugId, ...obj }));
  };

  try {
    log("=== DIAGNOSE TEACHER APPROVAL START ===", { method: req.method });

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
    const { teacherAddress } = body;

    if (!teacherAddress) {
      return new Response(
        JSON.stringify({ ok: false, error: 'teacherAddress required', debugId }),
        { status: 400, headers: corsHeaders }
      );
    }

    const rpcUrl = Deno.env.get("SEPOLIA_RPC_URL");
    const contractAddress = Deno.env.get("CONTRACT_ADDRESS");

    if (!rpcUrl || !contractAddress) {
      return new Response(
        JSON.stringify({ ok: false, error: 'RPC or contract not configured', debugId }),
        { status: 500, headers: corsHeaders }
      );
    }

    const rpcHost = new URL(rpcUrl).hostname;
    log("Environment loaded", { rpcHost, contractAddress, teacherAddress });

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const result: any = {
      ok: true,
      teacherAddress,
      contractAddress,
      rpcHost,
      accessControl: {},
      mappingChecks: {},
      owner: null,
      debugId
    };

    // A) AccessControl role checks
    log("Probing AccessControl roles...");

    // Try TEACHER_ROLE
    try {
      const teacherRole = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: parseAbi(["function TEACHER_ROLE() view returns (bytes32)"]),
        functionName: 'TEACHER_ROLE',
      });
      result.accessControl.TEACHER_ROLE = teacherRole;
      log("✓ TEACHER_ROLE found", { role: teacherRole });

      // Check if teacher has role
      try {
        const hasRole = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: parseAbi(["function hasRole(bytes32 role, address account) view returns (bool)"]),
          functionName: 'hasRole',
          args: [teacherRole, teacherAddress as `0x${string}`],
        });
        result.accessControl.hasTeacherRole = hasRole;
        log("✓ hasRole(TEACHER_ROLE) checked", { hasRole });
      } catch {
        result.accessControl.hasTeacherRole = null;
      }
    } catch {
      result.accessControl.TEACHER_ROLE = null;
      result.accessControl.hasTeacherRole = null;
    }

    // Try PLATFORM_ROLE
    try {
      const platformRole = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: parseAbi(["function PLATFORM_ROLE() view returns (bytes32)"]),
        functionName: 'PLATFORM_ROLE',
      });
      result.accessControl.PLATFORM_ROLE = platformRole;
      log("✓ PLATFORM_ROLE found", { role: platformRole });

      // Check if teacher has role
      try {
        const hasRole = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: parseAbi(["function hasRole(bytes32 role, address account) view returns (bool)"]),
          functionName: 'hasRole',
          args: [platformRole, teacherAddress as `0x${string}`],
        });
        result.accessControl.hasPlatformRole = hasRole;
        log("✓ hasRole(PLATFORM_ROLE) checked", { hasRole });
      } catch {
        result.accessControl.hasPlatformRole = null;
      }
    } catch {
      result.accessControl.PLATFORM_ROLE = null;
      result.accessControl.hasPlatformRole = null;
    }

    // Try DEFAULT_ADMIN_ROLE
    try {
      const adminRole = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: parseAbi(["function DEFAULT_ADMIN_ROLE() view returns (bytes32)"]),
        functionName: 'DEFAULT_ADMIN_ROLE',
      });
      result.accessControl.DEFAULT_ADMIN_ROLE = adminRole;
      log("✓ DEFAULT_ADMIN_ROLE found", { role: adminRole });

      try {
        const hasRole = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: parseAbi(["function hasRole(bytes32 role, address account) view returns (bool)"]),
          functionName: 'hasRole',
          args: [adminRole, teacherAddress as `0x${string}`],
        });
        result.accessControl.hasAdminRole = hasRole;
        log("✓ hasRole(DEFAULT_ADMIN_ROLE) checked", { hasRole });
      } catch {
        result.accessControl.hasAdminRole = null;
      }
    } catch {
      result.accessControl.DEFAULT_ADMIN_ROLE = null;
    }

    // B) Mapping / boolean checks
    log("Probing mapping/boolean checks...");

    const checkMethods = [
      { name: 'isTeacher', abi: "function isTeacher(address) view returns (bool)" },
      { name: 'isApprovedTeacher', abi: "function isApprovedTeacher(address) view returns (bool)" },
      { name: 'approvedTeachers', abi: "function approvedTeachers(address) view returns (bool)" },
      { name: 'teachers', abi: "function teachers(address) view returns (bool)" },
      { name: 'teacherApproved', abi: "function teacherApproved(address) view returns (bool)" },
      { name: 'isPlatform', abi: "function isPlatform(address) view returns (bool)" },
    ];

    for (const method of checkMethods) {
      try {
        const value = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: parseAbi([method.abi]),
          functionName: method.name,
          args: [teacherAddress as `0x${string}`],
        });
        result.mappingChecks[method.name] = value;
        log(`✓ ${method.name}() checked`, { value });
      } catch {
        result.mappingChecks[method.name] = null;
      }
    }

    // C) Owner check
    log("Probing owner...");
    try {
      const owner = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: parseAbi(["function owner() view returns (address)"]),
        functionName: 'owner',
      });
      result.owner = owner;
      log("✓ owner() found", { owner });
    } catch {
      result.owner = null;
    }

    log("=== ✓ DIAGNOSIS COMPLETE ===");

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("DIAGNOSE_ERROR", JSON.stringify({
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