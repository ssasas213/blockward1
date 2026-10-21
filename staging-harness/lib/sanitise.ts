// ============================================================================
// sanitise — redact secrets from error objects before logging or reporting.
//
// Pure, zero dependencies. No network, no viem, no secret access. Every
// function accepts arbitrary values and returns strings that are safe to
// log, display, or include in test reports.
//
// WHAT IS REDACTED:
//   - EVM private keys: 0x-prefixed 64-hex strings. Viem and ethers hold keys
//     internally in this exact format — the only form a key can take in a
//     viem error object. Transaction hashes share this format and are also
//     redacted in error messages (they are preserved in structured results,
//     where they belong; an error log is not the place for a tx hash).
//   - RPC URL API keys: long (32+) alphanumeric path segments (Alchemy,
//     Infura, etc. style) and ?apikey=… / ?token=… / ?key=… query parameters.
//
// WHAT IS PRESERVED:
//   - Bare 64-hex Merkle roots (no 0x prefix) — public verification artifacts.
//   - Short URL path segments (< 32 chars).
// ============================================================================

const PRIVATE_KEY_RE = /\b0x[0-9a-fA-F]{64}\b/g;
const URL_PATH_TOKEN_RE = /(https?:\/\/[^\s?]*\/)([a-zA-Z0-9_-]{32,})([?/\s]|$)/g;
const QUERY_PARAM_RE = /([?&](?:apikey|api_key|token|key|secret|access_token)=)[^&\s]+/gi;

export function redactSecrets(input: string): string {
  if (typeof input !== 'string') return '';
  let out = input;
  out = out.replace(PRIVATE_KEY_RE, '[REDACTED_KEY]');
  out = out.replace(QUERY_PARAM_RE, '$1[REDACTED]');
  out = out.replace(URL_PATH_TOKEN_RE, '$1[REDACTED_TOKEN]$3');
  return out;
}

const ERROR_CODE_MAP: Record<string, string> = {
  TransactionExecutionError: 'tx_execution_failed',
  ChainIdMismatchError: 'chain_id_mismatch',
  InvalidAddressError: 'invalid_address',
  PrivateKeyError: 'invalid_private_key',
  HttpRequestError: 'http_request_failed',
  TimeoutError: 'timeout',
  EstimateGasExecutionError: 'gas_estimation_failed',
  FeeCapTooLowError: 'fee_cap_too_low',
  NonceTooLowError: 'nonce_too_low',
  InsufficientFundsError: 'insufficient_funds',
  ResourceNotFoundError: 'resource_not_found',
  RpcRequestError: 'rpc_request_failed',
  UrlRequiredError: 'url_required',
};

export function errorToCode(e: unknown): string {
  if (e === null || e === undefined) return 'unknown_error';
  const name = (e as any)?.name;
  if (typeof name === 'string' && ERROR_CODE_MAP[name]) return ERROR_CODE_MAP[name];
  if (e instanceof Error) return 'unexpected_error';
  return 'unknown_error';
}

export interface SanitisedError {
  code: string;
  message: string;
}

export function sanitiseError(e: unknown): SanitisedError {
  if (e === null || e === undefined) {
    return { code: 'unknown_error', message: '' };
  }
  const code = errorToCode(e);
  const rawMessage = (e as any)?.message ?? String(e);
  const message = redactSecrets(typeof rawMessage === 'string' ? rawMessage : '');
  return { code, message };
}

export function safeLog(e: unknown): string {
  const { code, message } = sanitiseError(e);
  const detail = message ? ` ${message}` : '';
  const out = `${code}${detail}`;
  return out.length > 300 ? out.slice(0, 300) + '\u2026' : out;
}