// Classroom layout templates + auto-arrange helpers + attendance status definitions.
// Pure client-side helpers — all persistence goes through the seating backend functions.

export const ROOM_DEFAULT = { width: 12, height: 9, label: '' };

const uid = () => Math.random().toString(36).slice(2, 9);

function mkDesk(x, y, seats = 1, w = 2, h = 1, seatLayout = 'row') {
  return { id: uid(), type: 'desk', x, y, w, h, seats, seatLayout, assignments: Array(seats).fill(null) };
}

export const TEMPLATES = {
  blank: { label: 'Blank Classroom', build: (count) => ({
    room: { ...ROOM_DEFAULT },
    elements: [
      { id: uid(), type: 'whiteboard', x: 3, y: 0, w: 6, h: 1, label: 'Whiteboard' },
      { id: uid(), type: 'teacherDesk', x: 5, y: 8, w: 3, h: 1, label: "Teacher Desk" },
    ],
  }) },
  rows: { label: 'Standard Rows', build: (count) => {
    const cols = 4, rows = Math.max(2, Math.ceil(count / cols));
    const els = [
      { id: uid(), type: 'whiteboard', x: 3, y: 0, w: 6, h: 1, label: 'Whiteboard' },
      { id: uid(), type: 'teacherDesk', x: 5, y: 8, w: 3, h: 1, label: 'Teacher Desk' },
    ];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) els.push(mkDesk(1 + c * 2.7, 2 + r * 1.6, 1, 2, 1, 'row'));
    return { room: { ...ROOM_DEFAULT }, elements: els };
  } },
  pairs: { label: 'Pairs', build: (count) => {
    const cols = 4, rows = Math.max(2, Math.ceil(count / (cols * 2)));
    const els = [
      { id: uid(), type: 'whiteboard', x: 3, y: 0, w: 6, h: 1, label: 'Whiteboard' },
      { id: uid(), type: 'teacherDesk', x: 5, y: 8, w: 3, h: 1, label: 'Teacher Desk' },
    ];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) els.push(mkDesk(1 + c * 2.7, 2 + r * 1.7, 2, 2, 1, 'row'));
    return { room: { ...ROOM_DEFAULT }, elements: els };
  } },
  groups: { label: 'Group Tables', build: (count) => {
    const groups = Math.max(2, Math.ceil(count / 4));
    const els = [
      { id: uid(), type: 'whiteboard', x: 3, y: 0, w: 6, h: 1, label: 'Whiteboard' },
      { id: uid(), type: 'teacherDesk', x: 5, y: 8, w: 3, h: 1, label: 'Teacher Desk' },
    ];
    const perRow = 3;
    for (let i = 0; i < groups; i++) {
      const gx = 1 + (i % perRow) * 3.6, gy = 2 + Math.floor(i / perRow) * 3;
      els.push(mkDesk(gx, gy, 4, 3, 2, 'group'));
    }
    return { room: { ...ROOM_DEFAULT }, elements: els };
  } },
  exam: { label: 'Exam Layout', build: (count) => {
    const cols = 5, rows = Math.max(2, Math.ceil(count / cols));
    const els = [
      { id: uid(), type: 'whiteboard', x: 3, y: 0, w: 6, h: 1, label: 'Whiteboard' },
      { id: uid(), type: 'teacherDesk', x: 5, y: 8, w: 3, h: 1, label: 'Teacher Desk' },
    ];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) els.push(mkDesk(0.5 + c * 2.3, 2 + r * 1.5, 1, 2, 1, 'row'));
    return { room: { ...ROOM_DEFAULT }, elements: els };
  } },
  ushape: { label: 'U-Shape', build: (count) => {
    const els = [
      { id: uid(), type: 'whiteboard', x: 3, y: 0, w: 6, h: 1, label: 'Whiteboard' },
      { id: uid(), type: 'teacherDesk', x: 5, y: 4, w: 3, h: 1, label: 'Teacher Desk' },
    ];
    const side = Math.max(2, Math.ceil((count - 4) / 2));
    for (let i = 0; i < side; i++) { els.push(mkDesk(0.3, 2 + i * 1.6, 1, 1, 1, 'row')); els.push(mkDesk(10.7, 2 + i * 1.6, 1, 1, 1, 'row')); }
    for (let i = 0; i < 4; i++) els.push(mkDesk(1 + i * 2.3, 7, 1, 2, 1, 'row'));
    return { room: { ...ROOM_DEFAULT }, elements: els };
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