// Classroom layout templates + auto-arrange helpers + attendance status definitions.
// Pure client-side helpers — all persistence goes through the seating backend functions.

export const ROOM_DEFAULT = { width: 12, height: 10, label: '' };

const uid = () => Math.random().toString(36).slice(2, 9);
const round1 = (v) => Math.round(v * 10) / 10;

function mkDesk(x, y, seats = 1, w = 2, h = 1, seatLayout = 'row') {
  return { id: uid(), type: 'desk', x, y, w, h, seats, seatLayout, assignments: Array(seats).fill(null) };
}

// The teacher's desk is part of EVERY fresh plan: centred horizontally at the
// FRONT of the room, which is the BOTTOM of the canvas — the teacher's own
// point of view looking out at the class. Teachers can still move or delete it,
// but it never needs to be added manually.
export function mkTeacherDesk(room = ROOM_DEFAULT) {
  return {
    id: uid(),
    type: 'teacherDesk',
    x: round1((room.width - 3) / 2),
    y: round1(room.height - 2.3),
    w: 3,
    h: 1,
    label: 'Teacher Desk',
  };
}

export function mkWhiteboard(room = ROOM_DEFAULT) {
  return {
    id: uid(),
    type: 'whiteboard',
    x: round1((room.width - 6) / 2),
    y: round1(room.height - 1),
    w: 6,
    h: 1,
    label: 'Whiteboard',
  };
}

// Whiteboard sits on the front wall (bottom edge); teacher desk just in front of it.
const frontElements = (room) => [mkWhiteboard(room), mkTeacherDesk(room)];

// Desk rows are built from the FRONT (bottom) toward the back, shrinking the
// row gap when the roster needs more rows than the room comfortably fits.
function gapFor(firstY, rows, topMin, maxGap) {
  if (rows <= 1) return 0;
  return Math.max(1.0, Math.min(maxGap, (firstY - topMin) / (rows - 1)));
}

export const TEMPLATES = {
  blank: {
    label: 'Blank Classroom',
    build: () => ({ room: { ...ROOM_DEFAULT }, elements: frontElements(ROOM_DEFAULT) }),
  },
  rows: {
    label: 'Standard Rows',
    build: (count) => {
      const room = { ...ROOM_DEFAULT };
      const cols = 4;
      const rows = Math.max(2, Math.ceil(count / cols));
      const firstY = room.height - 3.6;
      const gap = gapFor(firstY, rows, 1.2, 1.6);
      const els = frontElements(room);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          els.push(mkDesk(1 + c * 2.7, round1(firstY - r * gap), 1, 2, 1, 'row'));
        }
      }
      return { room, elements: els };
    },
  },
  pairs: {
    label: 'Pairs',
    build: (count) => {
      const room = { ...ROOM_DEFAULT };
      const cols = 4;
      const rows = Math.max(2, Math.ceil(count / (cols * 2)));
      const firstY = room.height - 3.6;
      const gap = gapFor(firstY, rows, 1.2, 1.7);
      const els = frontElements(room);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          els.push(mkDesk(1 + c * 2.7, round1(firstY - r * gap), 2, 2, 1, 'row'));
        }
      }
      return { room, elements: els };
    },
  },
  groups: {
    label: 'Group Tables',
    build: (count) => {
      const room = { ...ROOM_DEFAULT };
      const groups = Math.max(2, Math.ceil(count / 4));
      const perRow = 3;
      const gRows = Math.ceil(groups / perRow);
      const firstY = room.height - 4.6;
      const gap = gRows > 1 ? Math.max(2.4, Math.min(3.2, (firstY - 1.5) / (gRows - 1))) : 0;
      const els = frontElements(room);
      for (let i = 0; i < groups; i++) {
        const r = Math.floor(i / perRow);
        const c = i % perRow;
        els.push(mkDesk(1 + c * 3.6, round1(firstY - r * gap), 4, 3, 2, 'group'));
      }
      return { room, elements: els };
    },
  },
  exam: {
    label: 'Exam Layout',
    build: (count) => {
      const room = { ...ROOM_DEFAULT };
      const cols = 5;
      const rows = Math.max(2, Math.ceil(count / cols));
      const firstY = room.height - 3.6;
      const gap = gapFor(firstY, rows, 1.0, 1.4);
      const els = frontElements(room);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          els.push(mkDesk(0.5 + c * 2.3, round1(firstY - r * gap), 1, 2, 1, 'row'));
        }
      }
      return { room, elements: els };
    },
  },
  ushape: {
    label: 'U-Shape',
    build: (count) => {
      const room = { ...ROOM_DEFAULT };
      const els = frontElements(room);
      const side = Math.max(2, Math.ceil((count - 4) / 2));
      const firstY = room.height - 5.2;
      const gap = gapFor(firstY, side, 1.2, 1.6);
      // Front row across the middle, opening toward the teacher's desk
      for (let i = 0; i < 4; i++) els.push(mkDesk(1.6 + i * 2.3, round1(room.height - 3.7), 1, 2, 1, 'row'));
      for (let i = 0; i < side; i++) {
        els.push(mkDesk(0.3, round1(firstY - i * gap), 1, 1, 1, 'row'));
        els.push(mkDesk(room.width - 1.3, round1(firstY - i * gap), 1, 1, 1, 'row'));
      }
      return { room, elements: els };
    },
  },
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
  const seatSlots = seats.filter(s => s !== null);
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