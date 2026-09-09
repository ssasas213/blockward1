import React, { useState } from 'react';
import { UserX } from 'lucide-react';

// Panel of students not yet assigned to any seat. Click-to-select,
// drag-to-seat, and a drop target: dragging a seated student back here
// unassigns them.
export default function UnassignedStudents({ roster, assignedEmails, selectedEmail, onSelect, onDropUnassign }) {
  const [over, setOver] = useState(false);
  const unassigned = roster.filter(s => !assignedEmails.has(s.student_email));
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const email = e.dataTransfer.getData('email');
        if (email && onDropUnassign) onDropUnassign(email);
      }}
      className={`rounded-xl border p-4 space-y-3 transition-colors ${over ? 'border-destructive bg-destructive/10' : 'border-border bg-card'}`}
    >
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
              onDragStart={(e) => { e.dataTransfer.setData('kind', 'student'); e.dataTransfer.setData('email', s.student_email); }}
              onClick={() => onSelect && onSelect(s.student_email)}
              className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${selectedEmail === s.student_email ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-hover'}`}
            >
              <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-semibold text-foreground">
                {(s.student_name || '').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <span className="text-sm text-foreground truncate flex-1">{s.student_name}</span>
            </div>
          ))}
        </div>
      )}
      <div className={`rounded-lg border border-dashed px-3 py-2.5 text-center text-[11px] ${over ? 'border-destructive text-destructive font-medium' : 'border-border text-muted-foreground'}`}>
        <UserX className="h-3.5 w-3.5 mx-auto mb-1" />
        Drag a seated student here to unassign them
      </div>
      <p className="text-[11px] text-muted-foreground">Drag a student onto a seat to seat them; drag between two seats to swap.</p>
    </div>
  );
}