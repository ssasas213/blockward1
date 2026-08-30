import React from 'react';
import { UserPlus, Search } from 'lucide-react';

// Panel of students not yet assigned to any seat. Supports click-to-select and drag-to-seat.
export default function UnassignedStudents({ roster, assignedEmails, selectedEmail, onSelect, onDragStart }) {
  const unassigned = roster.filter(s => !assignedEmails.has(s.student_email));
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Unassigned Students</h3>
        <span className="text-xs text-muted-foreground">{unassigned.length} left</span>
      </div>
      {unassigned.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">All students are seated.</p>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          {unassigned.map(s => (
            <div
              key={s.student_email}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('kind', 'student'); e.dataTransfer.setData('email', s.student_email); onDragStart && onDragStart(s.student_email); }}
              onClick={() => onSelect && onSelect(s.student_email)}
              className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${selectedEmail === s.student_email ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-hover'}`}
            >
              <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-semibold text-foreground">
                {(s.student_name || '').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <span className="text-sm text-foreground truncate flex-1">{s.student_name}</span>
              <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Drag a student onto a desk, or click a student then click a seat.</p>
    </div>
  );
}