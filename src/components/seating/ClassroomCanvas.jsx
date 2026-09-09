import React from 'react';
import { Presentation, DoorOpen, Square, Table2, Trash2, ArrowDownToLine } from 'lucide-react';
import SeatCard from './SeatCard';

function elementStyle(el, room) {
  return {
    left: `${(el.x / room.width) * 100}%`,
    top: `${(el.y / room.height) * 100}%`,
    width: `${(el.w / room.width) * 100}%`,
    height: `${(el.h / room.height) * 100}%`,
  };
}

function SeatGrid({ el, students, marks, mode, selectedEmail, onSeatClick, onSeatDrop, onUnassign }) {
  const n = el.seats || 1;
  const layout = el.seatLayout || 'row';
  const cols = layout === 'group' ? 2 : Math.min(n, 2);
  const rows = Math.ceil(n / cols);
  return (
    <div className="absolute inset-0.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
      {Array.from({ length: n }).map((_, i) => {
        const email = (el.assignments || [])[i] || null;
        const student = email ? students.find(s => s.student_email === email) || { student_email: email, student_name: email } : null;
        const draggable = mode === 'assign' && !!student;
        return (
          <div
            key={i}
            onDragOver={(e) => { if (mode === 'assign') e.preventDefault(); }}
            onDrop={(e) => {
              if (mode !== 'assign') return;
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.getData('kind') !== 'student') return;
              onSeatDrop && onSeatDrop(
                el.id,
                i,
                e.dataTransfer.getData('email'),
                e.dataTransfer.getData('fromElement') || null,
                e.dataTransfer.getData('fromSeat') === '' ? null : Number(e.dataTransfer.getData('fromSeat')),
              );
            }}
          >
            <SeatCard
              student={student}
              status={mode === 'attendance' ? (marks[email] || 'unmarked') : null}
              mode={mode}
              selected={selectedEmail && selectedEmail === email}
              onClick={() => onSeatClick && onSeatClick(el.id, i, email)}
              onUnassign={mode === 'assign' ? () => onUnassign && onUnassign(el.id, i) : null}
              onDragStart={draggable ? (e) => {
                e.dataTransfer.setData('kind', 'student');
                e.dataTransfer.setData('email', email);
                e.dataTransfer.setData('fromElement', el.id);
                e.dataTransfer.setData('fromSeat', String(i));
              } : null}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * ClassroomCanvas — the room is drawn from the teacher's point of view:
 * the FRONT of the class is the BOTTOM edge (labelled below), where every
 * fresh template places the teacher desk, centred.
 *
 * mode: 'view' (read-only) | 'layout' (place/move furniture) | 'assign'
 * (fill/swap seats by drag) | 'attendance' (tap seats to mark).
 */
export default function ClassroomCanvas({ layout, students, marks, mode, selectedEmail, onSeatClick, onSeatDrop, onUnassign, onUnassignByEmail, onDropElement, onDeleteElement }) {
  const room = layout?.room || { width: 12, height: 10 };
  const els = layout?.elements || [];

  const handleDrop = (e) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData('kind');
    if (kind === 'student') {
      // A drop that reached the canvas background missed every seat —
      // dragging a seated student off the plan unassigns them.
      if (mode === 'assign' && onUnassignByEmail) onUnassignByEmail(e.dataTransfer.getData('email'));
    } else if (kind === 'element') {
      if (mode !== 'layout') return;
      const id = e.dataTransfer.getData('id');
      const rect = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width * room.width;
      const py = (e.clientY - rect.top) / rect.height * room.height;
      onDropElement && onDropElement(id, px, py);
    }
  };

  return (
    <div
      className="relative w-full rounded-2xl border border-border bg-gradient-to-b from-secondary/30 to-background p-4 shadow-inner"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="relative w-full" style={{ aspectRatio: `${room.width} / ${room.height}`, minHeight: 320 }}>
        {els.map((el) => {
          const isDesk = el.type === 'desk';
          return (
            <div
              key={el.id}
              className={`absolute rounded-lg group/el ${isDesk ? '' : 'flex items-center justify-center text-[10px] font-medium text-muted-foreground'}`}
              style={elementStyle(el, room)}
              draggable={mode === 'layout' && isDesk}
              onDragStart={(e) => { e.dataTransfer.setData('kind', 'element'); e.dataTransfer.setData('id', el.id); }}
            >
              {mode === 'layout' && onDeleteElement && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDeleteElement(el.id); }}
                  className="absolute -top-2 -right-2 z-10 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/el:opacity-100 transition-opacity"
                  aria-label={`Delete ${el.label || el.type}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
              {el.type === 'whiteboard' && (
                <div className="w-full h-full rounded-lg bg-info/10 border border-info/30 flex items-center justify-center gap-1 text-info"><Presentation className="h-3.5 w-3.5" />{el.label || 'Whiteboard'}</div>
              )}
              {el.type === 'teacherDesk' && (
                <div className="w-full h-full rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center gap-1 text-primary"><Table2 className="h-3.5 w-3.5" />{el.label || 'Teacher Desk'}</div>
              )}
              {el.type === 'door' && (
                <div className="w-full h-full rounded-lg bg-warning/10 border border-warning/30 flex items-center justify-center gap-1 text-warning"><DoorOpen className="h-3.5 w-3.5" />Door</div>
              )}
              {el.type === 'window' && (
                <div className="w-full h-full rounded-lg border-2 border-dashed border-border flex items-center justify-center"><Square className="h-3 w-3" />Window</div>
              )}
              {el.type === 'empty' && (
                <div className="w-full h-full rounded-lg border border-dashed border-border/50" />
              )}
              {isDesk && (
                <div className="w-full h-full rounded-lg bg-card border border-border shadow-sm">
                  <SeatGrid el={el} students={students} marks={marks} mode={mode} selectedEmail={selectedEmail} onSeatClick={onSeatClick} onSeatDrop={onSeatDrop} onUnassign={onUnassign} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <ArrowDownToLine className="h-3.5 w-3.5" />
        Front of class
      </div>
    </div>
  );
}