// ============================================================================
// dotenv — minimal .env loader for the staging harness. Zero dependencies.
//
// Loads .env from the harness root into process.env IF present. Does NOT
// override existing environment variables (explicit env vars win over .env).
// Fails silently when .env is absent — the harness then relies on whatever
// the environment provides (or reports config-missing).
//
// This keeps staging secrets in a LOCAL file. They never touch Base44
// Secrets, the production database, or any backend function.
// ============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  const content = readFileSync(envPath, 'utf8');
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
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch {
  // .env not present — rely on the ambient environment (or config-missing).
}