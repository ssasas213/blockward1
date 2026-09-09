import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, X, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';
import ClassroomCanvas from './ClassroomCanvas';

// 180° rotation of every element's position: the plan is shown from the
// students' viewpoint without redrawing it, and every label stays readable.
function rotateLayout(layout) {
  if (!layout?.room || !layout?.elements) return layout;
  const { room } = layout;
  return {
    ...layout,
    elements: layout.elements.map(el => ({
      ...el,
      x: Math.round((room.width - el.x - el.w) * 10) / 10,
      y: Math.round((room.height - el.y - el.h) * 10) / 10,
    })),
  };
}

/**
 * SeatingPrintView — full-screen overlay for printing or projecting the plan.
 * Toggle between the teacher's viewpoint (front at the bottom, as drawn) and
 * the students' viewpoint (plan rotated 180°).
 */
export default function SeatingPrintView({ open, onClose, layout, students, classInfo, planName }) {
  const [studentsView, setStudentsView] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStudentsView(false);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !layout) return null;
  const shown = studentsView ? rotateLayout(layout) : layout;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .seating-print-area, .seating-print-area * { visibility: visible; }
          .seating-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 p-3 border-b border-border bg-card">
        <div className="mr-auto">
          <p className="font-semibold text-foreground leading-tight">{classInfo?.name || 'Seating plan'}</p>
          <p className="text-xs text-muted-foreground">{planName || 'Plan'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setStudentsView(v => !v)}>
          <RefreshCcw className="h-4 w-4" />
          {studentsView ? "Students' viewpoint" : "Teachers' viewpoint"}
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />Print
        </Button>
        <Button variant="outline" size="sm" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />Close
        </Button>
      </div>

      <div className="seating-print-area max-w-5xl mx-auto p-4">
        <div className="text-center mb-4">
          <h2 className="text-lg font-semibold text-foreground">{classInfo?.name}</h2>
          <p className="text-sm text-muted-foreground">
            {planName}{classInfo?.room ? ` · Room ${classInfo.room}` : ''} · {format(new Date(), 'dd MMM yyyy')}
          </p>
        </div>
        <ClassroomCanvas layout={shown} students={students} mode="view" />
        <p className="text-center text-xs text-muted-foreground mt-3">
          {studentsView
            ? "Students' viewpoint — the front of the class is at the top of this view"
            : "Teacher's viewpoint — the front of the class is at the bottom of the plan"}
        </p>
      </div>
    </div>
  );
}