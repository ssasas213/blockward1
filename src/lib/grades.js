// Grade calculation utilities — shared by frontend pages and grade display.
// The grading scale is school-configurable (GradingScale entity). If a school
// has no active scale, a sensible default letter scale is used.

export const DEFAULT_GRADE_BANDS = [
  { min_percentage: 90, grade: "A*", label: "A*" },
  { min_percentage: 80, grade: "A", label: "A" },
  { min_percentage: 70, grade: "B", label: "B" },
  { min_percentage: 60, grade: "C", label: "C" },
  { min_percentage: 50, grade: "D", label: "D" },
  { min_percentage: 0, grade: "F", label: "F" },
];

// Common preset scales for admin quick-setup
export const GRADE_PRESETS = {
  letters: {
    name: "Letter Grades (A*–F)",
    bands: DEFAULT_GRADE_BANDS,
  },
  gcse: {
    name: "GCSE 9–1",
    bands: [
      { min_percentage: 90, grade: "9" },
      { min_percentage: 80, grade: "8" },
      { min_percentage: 70, grade: "7" },
      { min_percentage: 60, grade: "6" },
      { min_percentage: 50, grade: "5" },
      { min_percentage: 40, grade: "4" },
      { min_percentage: 30, grade: "3" },
      { min_percentage: 20, grade: "2" },
      { min_percentage: 0, grade: "1" },
    ],
  },
  percentage: {
    name: "Percentage Bands",
    bands: [
      { min_percentage: 90, grade: "Excellent" },
      { min_percentage: 75, grade: "Good" },
      { min_percentage: 60, grade: "Satisfactory" },
      { min_percentage: 0, grade: "Needs Improvement" },
    ],
  },
};

export function calcPercentage(score, maxScore) {
  const s = Number(score);
  const m = Number(maxScore);
  if (!m || Number.isNaN(s) || Number.isNaN(m)) return null;
  return Math.round((s / m) * 1000) / 10; // 1 decimal place
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

// Colour coding for grade badges — restrained, enterprise tone
export function gradeColor(percentage) {
  if (percentage == null) return "text-muted-foreground bg-muted/50";
  if (percentage >= 80) return "text-success bg-success/10";
  if (percentage >= 60) return "text-primary bg-primary/10";
  if (percentage >= 40) return "text-warning bg-warning/10";
  return "text-destructive bg-destructive/10";
}

export function averagePercentages(percentages) {
  const valid = percentages.filter(p => p != null && !Number.isNaN(p));
  if (!valid.length) return null;
  return Math.round((valid.reduce((s, p) => s + p, 0) / valid.length) * 10) / 10;
}

// Build a CSV export string from a gradebook grid
export function gradebookToCSV(students, assessments, grades) {
  const headers = ["Student", ...assessments.map(a => a.title), "Average"];
  const rows = students.map((stu) => {
    const row = [stu.name || stu.email];
    let pctSum = 0, pctN = 0;
    for (const a of assessments) {
      const g = grades.find(x => x.student_email === stu.email && x.assessment_id === a.id);
      if (g && g.percentage != null) {
        row.push(`${g.raw_score}/${g.max_score}`);
        pctSum += g.percentage; pctN++;
      } else {
        row.push("");
      }
    }
    row.push(pctN ? `${Math.round((pctSum / pctN) * 10) / 10}%` : "");
    return row;
  });
  return [headers, ...rows]
    .map(r => r.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export const ASSESSMENT_TYPES = [
  { value: "exam", label: "Exam" },
  { value: "test", label: "Test" },
  { value: "quiz", label: "Quiz" },
  { value: "homework", label: "Homework" },
  { value: "coursework", label: "Coursework" },
  { value: "practical", label: "Practical" },
  { value: "project", label: "Project" },
  { value: "presentation", label: "Presentation" },
  { value: "other", label: "Other" },
];