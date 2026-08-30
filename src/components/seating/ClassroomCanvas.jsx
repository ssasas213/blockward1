import React from 'react';
import { Presentation, DoorOpen, Square, Table2 } from 'lucide-react';
import SeatCard from './SeatCard';

function elementStyle(el, room) {
  return {
    left: `${(el.x / room.width) * 100}%`,
    top: `${(el.y / room.height) * 100}%`,
    width: `${(el.w / room.width) * 100}%`,
    height: `${(el.h / room.height) * 100}%`,
  };
}

function SeatGrid({ el, students, marks, mode, selectedEmail, onSeatClick, onUnassign }) {
  const n = el.seats || 1;
  const layout = el.seatLayout || 'row';
  const cols = layout === 'group' ? 2 : Math.min(n, 2);
  const rows = Math.ceil(n / cols);
  return (
    <div className="absolute inset-0.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
      {Array.from({ length: n }).map((_, i) => {
        const email = (el.assignments || [])[i] || null;
        const student = email ? students.find(s => s.student_email === email) || { student_email: email, student_name: email } : null;
        return (
          <SeatCard
            key={i}
            student={student}
            status={mode === 'attendance' ? (marks[email] || 'unmarked') : null}
            mode={mode}
            selected={selectedEmail && selectedEmail === email}
            onClick={() => onSeatClick && onSeatClick(el.id, i, email)}
            onUnassign={mode === 'edit' ? () => onUnassign && onUnassign(el.id, i) : null}
          />
        );
      })}
    </div>
  );
}

export default function ClassroomCanvas({ layout, students, marks, mode, selectedEmail, onSeatClick, onUnassign, onDropStudent, onDropElement }) {
  const room = layout?.room || { width: 12, height: 9 };
  const els = layout?.elements || [];

  const handleDrop = (e) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData('kind');
    if (kind === 'student') {
      const email = e.dataTransfer.getData('email');
      const rect = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width * room.width;
      const py = (e.clientY - rect.top) / rect.height * room.height;
      const desk = els.find(el => el.type === 'desk' && px >= el.x && px <= el.x + el.w && py >= el.y && py <= el.y + el.h);
      if (desk && onDropStudent) onDropStudent(email, desk.id);
    } else if (kind === 'element') {
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
      <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-tertiary mb-2">Front of Class / Board</div>
      <div className="relative w-full" style={{ aspectRatio: `${room.width} / ${room.height}`, minHeight: 320 }}>
        {els.map((el) => {
          const isDesk = el.type === 'desk';
          return (
            <div
              key={el.id}
              className={`absolute rounded-lg ${isDesk ? '' : 'flex items-center justify-center text-[10px] font-medium text-muted-foreground'}`}
              style={elementStyle(el, room)}
              draggable={mode === 'edit' && isDesk}
              onDragStart={(e) => { e.dataTransfer.setData('kind', 'element'); e.dataTransfer.setData('id', el.id); }}
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
                <div className="w-full h-full rounded-lg bg-card/80 border border-border shadow-sm">
                  <SeatGrid el={el} students={students} marks={marks} mode={mode} selectedEmail={selectedEmail} onSeatClick={onSeatClick} onUnassign={onUnassign} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}