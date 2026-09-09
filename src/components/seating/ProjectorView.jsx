import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClassroomCanvas from './ClassroomCanvas';

// Full-screen presentation mode for projecting the seating plan. Requests
// browser fullscreen; the mirror option shows the plan from the students'
// viewpoint (rotated 180°) without redrawing it.
export default function ProjectorView({ layout, students, mirror, heading, planName, onExit }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    try {
      if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } catch { /* fullscreen not available — overlay still covers the screen */ }
    const onKey = (e) => { if (e.key === 'Escape') onExit(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      try {
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      } catch { /* ignore */ }
    };
  }, []);

  if (!layout) return null;

  return (
    <div ref={ref} className="fixed inset-0 z-50 bg-background p-4 sm:p-8 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground truncate">{heading || 'Seating plan'}</h2>
          <p className="text-sm text-muted-foreground">
            {planName || 'Seating plan'} · {mirror ? 'Student view' : 'Teacher view'} · front of class at the {mirror ? 'top' : 'bottom'}
          </p>
        </div>
        <Button onClick={onExit}><X className="h-4 w-4 mr-1.5" />Exit</Button>
      </div>
      <div className="flex-1 overflow-auto">
        <ClassroomCanvas layout={layout} students={students} mode="view" mirror={mirror} marks={{}} />
      </div>
    </div>
  );
}