// Classroom layout templates + auto-arrange helpers + attendance status definitions.
// Pure client-side helpers — all persistence goes through the seating backend functions.
//
// ORIENTATION — the canvas is drawn from the TEACHER'S POINT OF VIEW looking
// out at the class: the front wall (whiteboard + teacher desk) sits on the
// BOTTOM edge of the canvas, and students' desks spread upward toward the top
// (the back of the room). "Front of class" is labelled on the bottom edge.

export const ROOM_DEFAULT = { width: 12, height: 9, label: '' };

const uid = () => Math.random().toString(36).slice(2, 9);

function mkDesk(x, y, seats = 1, w = 2, h = 1, seatLayout = 'row') {
  return { id: uid(), type: 'desk', x, y, w, h, seats, seatLayout, assignments: Array(seats).fill(null) };
}

// Front-of-room furniture, included in EVERY template so a new plan never
// starts without the teacher desk: whiteboard on the front (bottom) wall,
// teacher desk centred horizontally directly in front of it. Teachers can
// move or remove it afterwards — but never need to add it by hand.
export function mkFront(room = ROOM_DEFAULT) {
  const { width: W, height: H } = { ...ROOM_DEFAULT, ...room };
  return [
    { id: uid(), type: 'whiteboard', x: (W - 6) / 2, y: H - 1, w: 6, h: 1, label: 'Whiteboard' },
    { id: uid(), type: 'teacherDesk', x: (W - 3) / 2, y: H - 2, w: 3, h: 1, label: 'Teacher Desk' },
  ];
}

export const TEMPLATES = {
  blank: { label: 'Blank Classroom', build: (count) => {
    const room = { ...ROOM_DEFAULT };
    return { room, elements: [...mkFront(room)] };
  } },
  rows: { label: 'Standard Rows', build: (count) => {
    const room = { ...ROOM_DEFAULT };
    const cols = 4, rows = Math.max(2, Math.ceil(count / cols));
    const step = Math.min(1.6, (room.height - 3) / rows);
    const els = [...mkFront(room)];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) els.push(mkDesk(1 + c * 2.7, 1 + r * step, 1, 2, 1, 'row'));
    return { room, elements: els };
  } },
  pairs: { label: 'Pairs', build: (count) => {
    const room = { ...ROOM_DEFAULT };
    const cols = 4, rows = Math.max(2, Math.ceil(count / (cols * 2)));
    const step = Math.min(1.7, (room.height - 3) / rows);
    const els = [...mkFront(room)];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) els.push(mkDesk(1 + c * 2.7, 1 + r * step, 2, 2, 1, 'row'));
    return { room, elements: els };
  } },
  groups: { label: 'Group Tables', build: (count) => {
    const room = { ...ROOM_DEFAULT };
    const groups = Math.max(2, Math.ceil(count / 4));
    const perRow = 3;
    const gRows = Math.ceil(groups / perRow);
    const step = Math.min(2.6, (room.height - 5) / gRows);
    const els = [...mkFront(room)];
    for (let i = 0; i < groups; i++) {
      const gx = 1 + (i % perRow) * 3.6, gy = 1 + Math.floor(i / perRow) * step;
      els.push(mkDesk(gx, gy, 4, 3, 2, 'group'));
    }
    return { room, elements: els };
  } },
  exam: { label: 'Exam Layout', build: (count) => {
    const room = { ...ROOM_DEFAULT };
    const cols = 5, rows = Math.max(2, Math.ceil(count / cols));
    const step = Math.min(1.5, (room.height - 3) / rows);
    const els = [...mkFront(room)];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) els.push(mkDesk(0.5 + c * 2.3, 1 + r * step, 1, 2, 1, 'row'));
    return { room, elements: els };
  } },
  ushape: { label: 'U-Shape', build: (count) => {
    const room = { ...ROOM_DEFAULT };
    const els = [...mkFront(room)];
    // Back row along the top edge (back of the room); sides down the left and
    // right walls; the U opens toward the front at the bottom.
    const back = Math.min(4, Math.max(0, count));
    for (let i = 0; i < back; i++) els.push(mkDesk(1 + i * 2.3, 1, 1, 2, 1, 'row'));
    const side = Math.max(2, Math.ceil((count - 4) / 2));
    const step = side > 1 ? Math.min(1.6, (room.height - 4.7) / (side - 1)) : 1.6;
    for (let i = 0; i < side; i++) {
      els.push(mkDesk(0.3, 2.7 + i * step, 1, 1, 1, 'row'));
      els.push(mkDesk(room.width - 1.3, 2.7 + i * step, 1, 1, 1, 'row'));
    }
    return { room, elements: els };
  } },
};

export const TEMPLATE_LIST = Object.entries(TEMPLATES).map(([k, v]) => ({ key: k, label: v.label }));

// Flatten all seats in a layout into [{ elementId, seatIndex, student_email|null }]
export function flattenSeats(layout) {
  const seats = [];
  for (const el of (layout?.elements || [])) {
    if (el.type !== 'desk') continue;
    const n = el.seats || 1;
    for (let i = 0; i < n; i++) seats.push({ elementId: el.id, seatIndex: i, student_email: (el.assignments || [])[i] || null });
  }
  return seats;
}

// Auto-arrange students across all seats of a layout.
export function autoArrange(layout, roster, mode = 'alphabetical') {
  const seats = flattenSeats(layout);
  const students = mode === 'random'
    ? [...roster].sort(() => Math.random() - 0.5)
    : [...roster].sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));
  let idx = 0;
  const elements = layout.elements.map(el => {
    if (el.type !== 'desk') return el;
    const assignments = (el.assignments || Array(el.seats || 1).fill(null)).map((cur, i) => {
      if (mode === 'spread') { // skip a seat between students when capacity allows
        if (i % 2 === 1 && seats.length > students.length) return null;
      }
      if (idx < students.length) { const s = students[idx++]; return s?.student_email || null; }
      return null;
    });
    return { ...el, assignments };
  });
  return { ...layout, elements };
}

export function clearSeats(layout) {
  const elements = layout.elements.map(el => el.type === 'desk' ? { ...el, assignments: Array(el.seats || 1).fill(null) } : el);
  return { ...layout, elements };
}

export const ATTENDANCE_STATUSES = [
  { key: 'unmarked', label: 'Unmarked', icon: 'Circle', ring: 'border-border', bg: 'bg-muted/40', text: 'text-muted-foreground' },
  { key: 'present', label: 'Present', icon: 'Check', ring: 'border-success', bg: 'bg-success/15', text: 'text-success' },
  { key: 'late', label: 'Late', icon: 'Clock', ring: 'border-warning', bg: 'bg-warning/15', text: 'text-warning' },
  { key: 'absent', label: 'Absent', icon: 'X', ring: 'border-destructive', bg: 'bg-destructive/15', text: 'text-destructive' },
  { key: 'excused', label: 'Excused', icon: 'ClipboardCheck', ring: 'border-info', bg: 'bg-info/15', text: 'text-info' },
];

export const STATUS_OF = Object.fromEntries(ATTENDANCE_STATUSES.map(s => [s.key, s]));