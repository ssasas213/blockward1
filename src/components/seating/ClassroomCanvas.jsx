import React from 'react';
import { Presentation, DoorOpen, Square, Table2, Trash2 } from 'lucide-react';
import SeatCard from './SeatCard';

// Canvas is drawn from the teacher's POV: the front wall is the BOTTOM edge.
// `mirror` rotates the whole plan 180° (students' viewpoint) without
// redrawing it — used by presentation and print.
function elementStyle(el, room, mirror) {
  const x = mirror ? room.width - el.x - el.w : el.x;
  const y = mirror ? room.height - el.y - el.h : el.y;
  return {
    left: `${(x / room.width) * 100}%`,
    top: `${(y / room.height) * 100}%`,
    width: `${(el.w / room.width) * 100}%`,
    height: `${(el.h / room.height) * 100}%`,
  };
}

function SeatGrid({ el, students, marks, mode, selectedEmail, onSeatClick, onUnassign, onDropStudentAtSeat }) {
  const n = el.seats || 1;
  const seatLayout = el.seatLayout || 'row';
  const cols = seatLayout === 'group' ? 2 : Math.min(n, 2);
  const rows = Math.ceil(n / cols);
  const assignable = mode === 'assign';
  return (
    <div className="absolute inset-0.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
      {Array.from({ length: n }).map((_, i) => {
        const email = (el.assignments || [])[i] || null;
        const student = email ? students.find(s => s.student_email === email) || { student_email: email, student_name: email } : null;
        return (
          <div
            key={i}
            className="h-full"
            draggable={assignable && !!email}
            onDragStart={(e) => {
              if (!assignable || !email) return;
              e.dataTransfer.setData('kind', 'student');
              e.dataTransfer.setData('email', email);
            }}
            onDragOver={(e) => { if (assignable) e.preventDefault(); }}
            onDrop={(e) => {
              if (!assignable || e.dataTransfer.getData('kind') !== 'student') return;
              e.preventDefault();
              e.stopPropagation();
              const droppedEmail = e.dataTransfer.getData('email');
              if (droppedEmail && onDropStudentAtSeat) onDropStudentAtSeat(droppedEmail, el.id, i);
            }}
          >
            <SeatCard
              student={student}
              status={mode === 'attendance' ? (marks[email] || 'unmarked') : null}
              mode={mode}
              selected={selectedEmail && selectedEmail === email}
              onClick={() => onSeatClick && onSeatClick(el.id, i, email)}
              onUnassign={assignable ? () => onUnassign && onUnassign(el.id, i) : null}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function ClassroomCanvas({
  layout, students, marks, mode, selectedEmail, mirror,
  onSeatClick, onUnassign, onDropStudent, onDropStudentAtSeat, onDropElement, onDeleteElement,
}) {
  const room = layout?.room || { width: 12, height: 9 };
  const els = layout?.elements || [];

  const handleDrop = (e) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData('kind');
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * room.width;
    const py = (e.clientY - rect.top) / rect.height * room.height;
    if (kind === 'student') {
      // Dropped on the room but not on a specific seat — fill the first free
      // seat of the desk under the cursor.
      const email = e.dataTransfer.getData('email');
      const desk = els.find(el => el.type === 'desk' && px >= el.x && px <= el.x + el.w && py >= el.y && py <= el.y + el.h);
      if (desk && onDropStudent) onDropStudent(email, desk.id);
    } else if (kind === 'element') {
      if (onDropElement) onDropElement(e.dataTransfer.getData('id'), px, py);
    }
  };

  const frontLabel = (
    <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground select-none">
      ─── Front of class ───
    </div>
  );

  return (
    <div
      className="relative w-full rounded-2xl border border-border bg-gradient-to-b from-secondary/30 to-background p-4 shadow-inner"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {mirror && <div className="mb-2">{frontLabel}</div>}
      <div className="relative w-full" style={{ aspectRatio: `${room.width} / ${room.height}`, minHeight: 320 }}>
        {els.map((el) => {
          const isDesk = el.type === 'desk';
          return (
            <div
              key={el.id}
              className={`group absolute rounded-lg ${isDesk ? '' : 'flex items-center justify-center text-[10px] font-medium text-muted-foreground'}`}
              style={elementStyle(el, room, mirror)}
              draggable={mode === 'layout' && isDesk}
              onDragStart={(e) => {
                if (mode !== 'layout' || !isDesk) return;
                e.dataTransfer.setData('kind', 'element');
                e.dataTransfer.setData('id', el.id);
              }}
            >
              {el.type === 'whiteboard' && (
                <div className="w-full h-full rounded-lg bg-info/10 border border-info/30 flex items-center justify-center gap-1 text-info"><Presentation className="h-3.5 w-3.5" />{el.label || 'Whiteboard'}</div>
              )}
              {el.type === 'teacherDesk' && (
                <div className="w-full h-full rounded-lg bg-secondary/60 border border-border flex items-center justify-center gap-1"><Table2 className="h-3.5 w-3.5" />{el.label || 'Teacher Desk'}</div>
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
                  <SeatGrid
                    el={el} students={students} marks={marks} mode={mode}
                    selectedEmail={selectedEmail}
                    onSeatClick={onSeatClick} onUnassign={onUnassign}
                    onDropStudentAtSeat={onDropStudentAtSeat}
                  />
                </div>
              )}
              {mode === 'layout' && onDeleteElement && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDeleteElement(el.id); }}
                  className="absolute -top-1.5 -right-1.5 z-10 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Remove ${el.label || el.type}`}
                  title={`Remove ${el.label || el.type}`}
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!mirror && <div className="mt-2">{frontLabel}</div>}
    </div>
  );
}