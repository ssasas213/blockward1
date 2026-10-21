// ============================================================================
// metrics — deterministic percentile computation for latency samples.
// Pure, no dependencies.
// ============================================================================

export interface LatencyStats {
  count: number;
  fastest: number;
  median: number;
  slowest: number;
  p95: number;
  mean: number;
}

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const frac = rank - lower;
  return sortedAsc[lower] + (sortedAsc[upper] - sortedAsc[lower]) * frac;
}

export function computeStats(samplesMs: number[]): LatencyStats {
  if (samplesMs.length === 0) {
    return { count: 0, fastest: 0, median: 0, slowest: 0, p95: 0, mean: 0 };
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const count = sorted.length;
  const fastest = sorted[0];
  const slowest = sorted[count - 1];
  const median = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / count;
  return { count, fastest, median, slowest, p95, mean };
}

export function formatMs(ms: number): string {
  return `${ms.toFixed(0)}ms`;
}