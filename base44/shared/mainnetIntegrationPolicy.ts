// Shared public constants and exact unit conversions. No I/O or signing.
export const INTEGRATION_ID = 'blockward:polygon-mainnet-integration-test:v1:synthetic-only';
export const DEFAULT_MAX_FEE_POL = '0.001';
export const HARD_MAX_FEE_WEI = 10000000000000000n; // 0.01 POL

export function feeCeilingWei(raw: string): bigint | null {
  if (raw.length > 24 || !/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  const wei = BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
  return wei > 0n && wei <= HARD_MAX_FEE_WEI ? wei : null;
}

export function formatPol(wei: bigint): string {
  const fraction = (wei % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return `${wei / 10n ** 18n}${fraction ? `.${fraction}` : ''}`;
}
