// Shared grade calculation for backend functions (Deno).
// Mirrors src/lib/grades.js but importable from Deno functions.

export const DEFAULT_GRADE_BANDS = [
  { min_percentage: 90, grade: "A*" },
  { min_percentage: 80, grade: "A" },
  { min_percentage: 70, grade: "B" },
  { min_percentage: 60, grade: "C" },
  { min_percentage: 50, grade: "D" },
  { min_percentage: 0, grade: "F" },
];

export function calcPercentage(score, maxScore) {
  const s = Number(score);
  const m = Number(maxScore);
  if (!m || Number.isNaN(s) || Number.isNaN(m)) return null;
  return Math.round((s / m) * 1000) / 10;
}

export function calcGrade(percentage, bands) {
  const b = bands && bands.length ? bands : DEFAULT_GRADE_BANDS;
  if (percentage == null || Number.isNaN(percentage)) return null;
  const sorted = [...b].sort((a, c) => Number(c.min_percentage) - Number(a.min_percentage));
  for (const band of sorted) {
    if (percentage >= Number(band.min_percentage)) return band.grade || band.label;
  }
  return sorted[sorted.length - 1]?.grade || null;
}

export function averagePercentages(percentages) {
  const valid = percentages.filter(p => p != null && !Number.isNaN(p));
  if (!valid.length) return null;
  return Math.round((valid.reduce((s, p) => s + p, 0) / valid.length) * 10) / 10;
}