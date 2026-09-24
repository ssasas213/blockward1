import React from 'react';
import { GraduationCap, BadgeCheck } from 'lucide-react';

/**
 * PublicGradesSection — the opt-in grades block on the public profile.
 * Renders ONLY data.public_grades produced grades (publicProfileData), which
 * are published, public-safe fields: subject, final grade, percentage, term.
 * Teacher comments, teacher names and assessment internals never reach here.
 */
export default function PublicGradesSection({ grades }) {
  if (!grades?.length) return null;
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-lg font-semibold text-foreground">Grades</h2>
        <BadgeCheck className="h-4 w-4 text-success" />
      </div>
      <p className="text-xs text-tertiary mb-4">
        Published grades, shared by the student — latest result per subject
      </p>
      <div className="pf-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {grades.map((g) => (
          <div key={g.subject} className="pf-tile rounded-xl border border-border bg-card p-4 flex flex-col justify-between min-h-[96px]">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground leading-snug">{g.subject}</p>
              <GraduationCap className="h-4 w-4 text-primary flex-shrink-0" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-2xl font-bold text-foreground">{g.grade || '—'}</span>
              <span className="text-xs text-muted-foreground text-right">
                {typeof g.percentage === 'number' && <span className="block font-medium">{g.percentage}%</span>}
                {g.term && <span className="block">{g.term}</span>}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}