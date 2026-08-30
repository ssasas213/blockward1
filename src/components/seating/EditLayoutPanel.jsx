import React from 'react';
import { TEMPLATE_LIST } from './templates';
import { Plus, Trash2, LayoutTemplate } from 'lucide-react';

const ELEMENT_TYPES = [
  { type: 'desk', label: 'Single Desk', seats: 1, w: 2, h: 1, seatLayout: 'row' },
  { type: 'desk', label: 'Double Desk', seats: 2, w: 2, h: 1, seatLayout: 'row' },
  { type: 'desk', label: 'Table (4)', seats: 4, w: 3, h: 2, seatLayout: 'group' },
  { type: 'desk', label: 'Group (6)', seats: 6, w: 4, h: 2, seatLayout: 'group' },
  { type: 'whiteboard', label: 'Whiteboard', w: 6, h: 1 },
  { type: 'teacherDesk', label: 'Teacher Desk', w: 3, h: 1 },
  { type: 'door', label: 'Door', w: 1, h: 1 },
  { type: 'window', label: 'Window', w: 3, h: 1 },
  { type: 'empty', label: 'Empty Space', w: 2, h: 1 },
];

const uid = () => Math.random().toString(36).slice(2, 9);

export default function EditLayoutPanel({ layout, onLayout, onAddElement, onDeleteElement, onApplyTemplate, onClearSeats, isMobile }) {
  if (isMobile) {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
        Layout editing works best on a larger screen. On mobile you can still take attendance from the seating plan.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><LayoutTemplate className="h-4 w-4 text-primary" />Templates</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TEMPLATE_LIST.map(t => (
            <button key={t.key} onClick={() => onApplyTemplate(t.key)} className="px-2.5 py-2 rounded-lg border border-border bg-background text-xs font-medium text-foreground hover:border-primary/40 hover:bg-hover transition-colors">{t.label}</button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />Add to room</h3>
        <div className="flex flex-wrap gap-2">
          {ELEMENT_TYPES.map((et, i) => (
            <button key={i} onClick={() => onAddElement({ id: uid(), x: 1, y: 2, ...et, assignments: et.type === 'desk' ? Array(et.seats).fill(null) : undefined })} className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground hover:border-primary/40 hover:bg-hover transition-colors">{et.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-3 pt-2">
          <label className="text-xs text-muted-foreground">Room width</label>
          <input type="number" min={6} max={20} value={layout.room?.width || 12} onChange={e => onLayout({ ...layout, room: { ...layout.room, width: Number(e.target.value) } })} className="w-16 h-8 rounded-md bg-background border border-border px-2 text-sm text-foreground" />
          <label className="text-xs text-muted-foreground">height</label>
          <input type="number" min={5} max={16} value={layout.room?.height || 9} onChange={e => onLayout({ ...layout, room: { ...layout.room, height: Number(e.target.value) } })} className="w-16 h-8 rounded-md bg-background border border-border px-2 text-sm text-foreground" />
          <label className="text-xs text-muted-foreground">label</label>
          <input type="text" value={layout.room?.label || ''} onChange={e => onLayout({ ...layout, room: { ...layout.room, label: e.target.value } })} placeholder="B204" className="w-24 h-8 rounded-md bg-background border border-border px-2 text-sm text-foreground" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onClearSeats} className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground hover:bg-hover">Clear all seats</button>
      </div>
    </div>
  );
}