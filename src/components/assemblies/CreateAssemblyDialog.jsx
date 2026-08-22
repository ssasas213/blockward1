import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const AUDIENCE_OPTIONS = [
  { value: 'whole_school', label: 'Whole School', adminOnly: false },
  { value: 'selected_classes', label: 'Selected Classes', adminOnly: false },
  { value: 'year_group', label: 'Year Group', adminOnly: true },
  { value: 'staff', label: 'Staff', adminOnly: true },
  { value: 'custom', label: 'Custom Audience', adminOnly: true },
];

export default function CreateAssemblyDialog({ open, onClose, classes, yearGroups, isAdmin, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', start_time: '', end_time: '', location: '', organiser: '', audience: 'whole_school', audience_classes: [], year_group_ids: [], notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ title: '', description: '', start_time: '', end_time: '', location: '', organiser: '', audience: isAdmin ? 'whole_school' : 'selected_classes', audience_classes: [], year_group_ids: [], notes: '' });
  }, [open, isAdmin]);

  const options = AUDIENCE_OPTIONS.filter(o => isAdmin || !o.adminOnly);

  const handleSave = async () => {
    if (!form.title.trim() || !form.start_time) { toast.error('Title and start time are required'); return; }
    if (form.audience === 'selected_classes' && !form.audience_classes.length) { toast.error('Select at least one class'); return; }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('assemblyAction', { action: 'create', ...form, title: form.title.trim() });
      if (res.data?.ok) { toast.success('Assembly created — affected students notified'); onCreated?.(); onClose(); }
      else toast.error(res.data?.message || 'Failed to create assembly');
    } catch (e) { toast.error(e.message || 'Failed to create assembly'); }
    finally { setSaving(false); }
  };

  const toggleClass = (id) => setForm(f => ({ ...f, audience_classes: f.audience_classes.includes(id) ? f.audience_classes.filter(x => x !== id) : [...f.audience_classes, id] }));
  const toggleYG = (id) => setForm(f => ({ ...f, year_group_ids: f.year_group_ids.includes(id) ? f.year_group_ids.filter(x => x !== id) : [...f.year_group_ids, id] }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Assembly</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Year 10 Assembly" autoFocus /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Start *</Label><Input type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} /></div>
            <div className="space-y-2"><Label>End</Label><Input type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Location</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Main Hall" /></div>
            <div className="space-y-2"><Label>Organiser</Label><Input value={form.organiser} onChange={e => setForm(f => ({ ...f, organiser: e.target.value }))} placeholder="Organiser name" /></div>
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <select value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm text-foreground focus:ring-2 focus:ring-primary">
              {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {form.audience === 'selected_classes' && (
            <div className="space-y-2">
              <Label>Classes</Label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {classes.map(c => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" checked={form.audience_classes.includes(c.id)} onChange={() => toggleClass(c.id)} className="rounded" />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {form.audience === 'year_group' && (
            <div className="space-y-2">
              <Label>Year Groups</Label>
              <div className="grid grid-cols-2 gap-2">
                {yearGroups.map(y => (
                  <label key={y.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" checked={form.year_group_ids.includes(y.id)} onChange={() => toggleYG(y.id)} className="rounded" />
                    <span>{y.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2"><Label>Description</Label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}