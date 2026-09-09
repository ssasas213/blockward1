import React from 'react';
import { format } from 'date-fns';

// Print-only rendering of the seating plan: white background, ink-friendly,
// fixed to the page in print media and hidden on screen. Mirroring rotates
// the plan 180° so a teacher-POV plan can print as the students see it.
export default function PrintableSeatingPlan({ layout, students, mirror, heading, planName }) {
  const room = layout?.room || { width: 12, height: 9 };
  const els = (layout?.elements || []).filter(el => el.type !== 'empty');
  const pos = (el) => {
    const x = mirror ? room.width - el.x - el.w : el.x;
    const y = mirror ? room.height - el.y - el.h : el.y;
    return {
      left: `${(x / room.width) * 100}%`,
      top: `${(y / room.height) * 100}%`,
      width: `${(el.w / room.width) * 100}%`,
      height: `${(el.h / room.height) * 100}%`,
    };
  };
  const nameOf = (email) => (students.find(s => s.student_email === email)?.student_name) || email;

  return (
    <div id="seating-print-root">
      <style>{`
        #seating-print-root { display: none; }
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          body * { visibility: hidden !important; }
          #seating-print-root, #seating-print-root * { visibility: visible !important; }
          #seating-print-root {
            display: block !important;
            position: fixed; left: 0; top: 0; width: 100%;
            background: #fff; color: #000;
          }
        }
      `}</style>
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#000' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{heading || 'Seating plan'}</div>
            <div style={{ fontSize: 12, color: '#444' }}>
              {planName || 'Seating plan'} · {mirror ? 'Student view' : 'Teacher view'} · printed {format(new Date(), 'd MMM yyyy')}
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#444' }}>Front of class: {mirror ? 'top of page' : 'bottom of page'}</div>
        </div>
        <div style={{ position: 'relative', width: '100%', maxWidth: 680, aspectRatio: `${room.width} / ${room.height}`, border: '2px solid #000' }}>
          {els.map(el => (
            <div key={el.id} style={{ position: 'absolute', ...pos(el) }}>
              {el.type === 'whiteboard' && (
                <div style={{ width: '100%', height: '100%', border: '1px solid #000', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>Whiteboard</div>
              )}
              {el.type === 'teacherDesk' && (
                <div style={{ width: '100%', height: '100%', border: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>Teacher Desk</div>
              )}
              {el.type === 'door' && (
                <div style={{ width: '100%', height: '100%', border: '1px dashed #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>Door</div>
              )}
              {el.type === 'window' && (
                <div style={{ width: '100%', height: '100%', border: '2px dashed #888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>Window</div>
              )}
              {el.type === 'desk' && (
                <div style={{ position: 'absolute', inset: 4, display: 'grid', gap: 4, gridTemplateColumns: (el.seatLayout === 'group' || (el.seats || 1) > 1) ? 'repeat(2, 1fr)' : '1fr' }}>
                  {Array.from({ length: el.seats || 1 }).map((_, i) => {
                    const email = (el.assignments || [])[i] || null;
                    return (
                      <div key={i} style={{ border: '1px solid #999', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: email ? 10 : 9, color: email ? '#000' : '#aaa', padding: 2, overflow: 'hidden' }}>
                        {email ? nameOf(email) : '—'}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: '#444' }}>
          Dashes are empty seats · {students.length} students on roster · Room {room.label || '—'}
        </div>
      </div>
    </div>
  );
}