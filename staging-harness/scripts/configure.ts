// ============================================================================
// configure — secure masked-entry configuration for the Amoy staging harness.
//
// Modes:
//   npx tsx scripts/configure.ts --setup
//       Prompt for each value with masked input, validate, write .env
//   npx tsx scripts/configure.ts --check
//       Read-only validation (no network, no sign, no broadcast)
//   npx tsx scripts/configure.ts --check --network
//       Also probe the live chain ID (read-only RPC, no sign/broadcast)
//
// SECURITY:
//   - Private keys are NEVER displayed, logged, or echoed — only "present".
//   - Input is masked (raw-mode terminal) — characters show as asterisks.
//   - The .env file is written with mode 0600 (owner-only read/write).
//   - .env is in .gitignore — never committed.
//   - Staging secrets never touch Base44 Secrets or the production database.
// ============================================================================

import { readFileSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import { redactSecrets } from '../lib/sanitise.ts';

const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env');

const ARGS = process.argv.slice(2);
const MODE_CHECK = ARGS.includes('--check');
const WITH_NETWORK = ARGS.includes('--network');

type DisplayMode = 'hidden' | 'masked' | 'full';

interface Field {
  name: string;
  label: string;
  hint: string;
  display: DisplayMode;
  validate: (v: string) => { ok: true } | { ok: false; reason: string };
}

const FIELDS: Field[] = [
  {
    name: 'AMOY_STAGING_RPC_URL',
    label: 'Amoy RPC URL',
    hint: 'https://polygon-amoy.g.alchemy.com/v2/<API_KEY>',
    display: 'masked',
    validate: (v) => {
      if (!v) return { ok: false, reason: 'empty' };
      if (!/^https:\/\//.test(v)) return { ok: false, reason: 'must start with https://' };
      return { ok: true };
    },
  },
  {
    name: 'AMOY_STAGING_ANCHOR_ADDRESS',
    label: 'Staging wallet address',
    hint: '0x + 40 hex (public address)',
    display: 'full',
    validate: (v) => {
      if (!v) return { ok: false, reason: 'empty' };
      if (!/^0x[0-9a-fA-F]{40}$/.test(v)) return { ok: false, reason: 'must be 0x + 40 hex chars' };
      return { ok: true };
    },
  },
  {
    name: 'AMOY_STAGING_PRIVATE_KEY',
    label: 'Staging private key',
    hint: '0x + 64 hex (NEVER use a production key)',
    display: 'hidden',
    validate: (v) => {
      if (!v) return { ok: false, reason: 'empty' };
      if (!/^0x[0-9a-fA-F]{64}$/.test(v)) return { ok: false, reason: 'must be 0x + 64 hex chars' };
      return { ok: true };
    },
  },
];

// ── .env file operations ────────────────────────────────────────────────────

function parseEnvFile(path: string): Record<string, string> {
  const values: Record<string, string> = {};
  if (!existsSync(path)) return values;
  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) values[key] = val;
  }
  return values;
}

function writeEnvFile(path: string, values: Record<string, string>): void {
  const lines = [
    '# Blockward Amoy Staging Harness — Local Configuration',
    '# DO NOT COMMIT THIS FILE (already in .gitignore)',
    `# Generated: ${new Date().toISOString()}`,
    '# Staging secrets only — never stored in Base44 Secrets or the production database.',
    '',
    `AMOY_STAGING_RPC_URL=${values.AMOY_STAGING_RPC_URL || ''}`,
    `AMOY_STAGING_ANCHOR_ADDRESS=${values.AMOY_STAGING_ANCHOR_ADDRESS || ''}`,
    `AMOY_STAGING_PRIVATE_KEY=${values.AMOY_STAGING_PRIVATE_KEY || ''}`,
    '',
  ];
  writeFileSync(path, lines.join('\n'), { encoding: 'utf8', mode: 0o600 });
  chmodSync(path, 0o600); // owner-only read/write
}

// ── Masked input ─────────────────────────────────────────────────────────────

async function promptMasked(label: string): Promise<string> {
  if (!process.stdin.isTTY) {
    console.log('  \u26a0 stdin is not a terminal — input will not be masked');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((r) => {
      rl.question(`  ${label}: `, (answer) => { rl.close(); r(answer.trim()); });
    });
  }

  process.stdout.write(`  ${label}: `);
  return new Promise((resolve) => {
    let input = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onKey = (char: string) => {
      const code = char.charCodeAt(0);
      if (code === 13 || code === 10) { // Enter
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onKey);
        process.stdout.write('\n');
        resolve(input);
      } else if (code === 3) { // Ctrl+C
        process.stdin.setRawMode(false);
        process.stdout.write('\n');
        process.exit(0);
      } else if (code === 127 || code === 8) { // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (code >= 32 && code < 127) { // Printable ASCII
        input += char;
        process.stdout.write('*');
      }
    };

    process.stdin.on('data', onKey);
  });
}

// ── Setup mode ───────────────────────────────────────────────────────────────

async function setup(): Promise<void> {
  console.log('\u2550'.repeat(72));
  console.log('  Blockward Amoy Staging — Secure Configuration');
  console.log('\u2550'.repeat(72));
  console.log('');
  console.log('  This tool writes staging secrets to a LOCAL .env file.');
  console.log('  Secrets never touch Base44 Secrets or the production database.');
  console.log('  Input is masked — characters appear as asterisks (*).');
  console.log('  Press Enter to keep an existing value.');
  console.log('');

  const existing = parseEnvFile(ENV_PATH);
  const values: Record<string, string> = {};

  for (const field of FIELDS) {
    console.log(`  ${field.label}`);
    console.log(`    hint: ${field.hint}`);
    if (existing[field.name]) {
      console.log('    existing: present (Enter to keep)');
    }

    while (true) {
      const input = await promptMasked(field.label);
      const value = input.trim();

      if (!value && existing[field.name]) {
        values[field.name] = existing[field.name];
        console.log('    \u2713 kept existing value');
        break;
      }

      if (!value && !existing[field.name]) {
        values[field.name] = '';
        console.log('    \u2717 skipped');
        break;
      }

      const check = field.validate(value);
      if (check.ok) {
        values[field.name] = value;
        console.log('    \u2713 accepted');
        break;
      }
      console.log(`    \u2717 invalid: ${check.reason}`);
    }
    console.log('');
  }

  writeEnvFile(ENV_PATH, values);
  console.log('  .env written (mode 0600 — owner-only access)');
  console.log('  .env is in .gitignore — it will not be committed.');
  console.log('');
  console.log('  Configuration summary:');
  for (const field of FIELDS) {
    const present = !!values[field.name];
    console.log(`    ${field.name}: ${present ? '\u2713 present' : '\u2717 empty'}`);
  }
  console.log('');
  console.log('  Run `npx tsx scripts/configure.ts --check` to validate.');
  console.log('\u2550'.repeat(72));
}

// ── Check mode ───────────────────────────────────────────────────────────────

function displayValue(field: Field, raw: string): string {
  switch (field.display) {
    case 'hidden': return 'present (value hidden)';
    case 'masked': return redactSecrets(raw);
    case 'full': return raw;
  }
}

async function check(): Promise<void> {
  console.log('\u2550'.repeat(72));
  console.log('  Blockward Amoy Staging — Read-Only Configuration Check');
  console.log(`  ${WITH_NETWORK ? 'with network probe (read-only, no sign/broadcast)' : 'local only (no network)'}`);
  console.log('\u2550'.repeat(72));
  console.log('');

  const fileValues = parseEnvFile(ENV_PATH);

  if (Object.keys(fileValues).length === 0) {
    console.log('  .env not found. Run `npx tsx scripts/configure.ts --setup` first.');
    console.log('');
    console.log('\u2550'.repeat(72));
    process.exit(1);
  }

  let allOk = true;
  const checks: { name: string; status: string; detail: string }[] = [];

  // 1. Presence + format
  for (const field of FIELDS) {
    const raw = fileValues[field.name] || '';
    if (!raw) {
      checks.push({ name: field.name, status: 'MISSING', detail: '' });
      allOk = false;
      continue;
    }
    const fmt = field.validate(raw);
    if (!fmt.ok) {
      checks.push({ name: field.name, status: 'INVALID', detail: fmt.reason });
      allOk = false;
      continue;
    }
    checks.push({ name: field.name, status: 'OK', detail: displayValue(field, raw) });
  }

  // 2. Address derivation match (pure computation — no signing, no network)
  const privKey = fileValues.AMOY_STAGING_PRIVATE_KEY || '';
  const addr = fileValues.AMOY_STAGING_ANCHOR_ADDRESS || '';
  if (privKey && addr && /^0x[0-9a-fA-F]{64}$/.test(privKey) && /^0x[0-9a-fA-F]{40}$/.test(addr)) {
    try {
      const { privateKeyToAccount } = await import('viem/accounts');
      const derived = privateKeyToAccount(privKey as `0x${string}`).address;
      const match = derived.toLowerCase() === addr.toLowerCase();
      checks.push({
        name: 'Address match',
        status: match ? 'OK' : 'MISMATCH',
        detail: match ? `derived ${derived.slice(0, 10)}\u2026 matches declared` : `derived ${derived.slice(0, 10)}\u2026 \u2260 declared`,
      });
      if (!match) allOk = false;
    } catch {
      checks.push({ name: 'Address match', status: 'ERROR', detail: 'cannot derive (invalid key)' });
      allOk = false;
    }
  }

  // 3. Optional network probe (read-only — no sign, no broadcast)
  if (WITH_NETWORK && allOk) {
    const rpc = fileValues.AMOY_STAGING_RPC_URL;
    try {
      const { createPublicClient, http } = await import('viem');
      const pub = createPublicClient({
        chain: { id: 80002, name: 'Polygon Amoy', nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 }, rpcUrls: { default: { http: [rpc] } } },
        transport: http(rpc),
      });
      const chainId = await pub.getChainId();
      checks.push({
        name: 'Live chain ID',
        status: chainId === 80002 ? 'OK' : 'WRONG',
        detail: chainId === 80002 ? 'Polygon Amoy (80002)' : `got ${chainId}, expected 80002`,
      });
      if (chainId !== 80002) allOk = false;
    } catch {
      checks.push({ name: 'Live chain ID', status: 'UNAVAILABLE', detail: 'RPC unreachable (read-only probe)' });
      allOk = false;
    }
  }

  // Print report
  console.log('  Field checks:');
  for (const c of checks) {
    const symbol = c.status === 'OK' ? '\u2713' : '\u2717';
    console.log(`    ${symbol} ${c.name}: ${c.status}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  console.log('');
  console.log(`  ${allOk ? '\u2713 All checks passed.' : '\u2717 Some checks failed.'}`);
  if (!WITH_NETWORK && allOk) {
    console.log('  Add --network to also probe the live chain ID (read-only).');
  }
  console.log('');
  console.log('\u2550'.repeat(72));
  process.exit(allOk ? 0 : 1);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (MODE_CHECK) {
    await check();
  } else {
    await setup();
  }
}

main().catch((e) => {
  console.error('Fatal:', e?.message || String(e));
  process.exit(1);
});