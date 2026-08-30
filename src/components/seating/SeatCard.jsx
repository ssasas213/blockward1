import React from 'react';
import { Check, Clock, X, ClipboardCheck, Circle, UserX } from 'lucide-react';
import { STATUS_OF } from './templates';

const ICONS = { Check, Clock, X, ClipboardCheck, Circle };

export default function SeatCard({ student, status, mode, selected, onClick, onUnassign }) {
  const st = status ? STATUS_OF[status] : STATUS_OF.unmarked;
  const Ic = ICONS[st.icon] || Circle;
  const initials = student ? (student.student_name || '').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full h-full min-h-[58px] rounded-lg border ${st.ring} ${student ? 'bg-card' : 'bg-muted/20 border-dashed'} ${st.bg} ${selected ? 'ring-2 ring-primary' : ''} flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center transition-all hover:border-primary/40`}
    >
      {student ? (
        <>
          <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-semibold text-foreground">
            {initials || '?'}
          </div>
          <span className="text-[11px] font-medium text-foreground leading-tight truncate w-full">{student.student_name}</span>
          {mode === 'attendance' && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] ${st.text} font-medium`}>
              <Ic className="h-2.5 w-2.5" />{st.label}
            </span>
          )}
          {mode === 'edit' && onUnassign && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onUnassign(); }}
              className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Unassign"
            >
              <X className="h-2.5 w-2.5" />
            </span>
          )}
        </>
      ) : (
        <span className="text-[10px] text-muted-foreground">{mode === 'attendance' ? <Ic className="h-4 w-4 mx-auto opacity-50" /> : 'Empty'}</span>
      )}
    </button>
  );
}