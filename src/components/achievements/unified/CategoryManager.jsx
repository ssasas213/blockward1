import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { createCategory, updateCategory, deleteCategory } from '@/lib/achievementMeta';
import { CATEGORY_ICONS, CATEGORY_COLORS, ICON_OPTIONS, COLOR_OPTIONS } from './CategoryVisual';
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, Check, X } from 'lucide-react';

/**
 * CategoryManager — create, rename, reorder and delete the holder's personal
 * achievement categories. Deleting a category keeps its achievements: they
 * simply become uncategorised (the metadata rows keep the orphaned id).
 */
export default function CategoryManager({ open, onOpenChange, email, cats = [], onChanged }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Shapes');
  const [color, setColor] = useState('slate');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('Shapes');
  const [editColor, setEditColor] = useState('slate');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) { toast.error('Give the category a name'); return; }
    setBusy(true);
    try {
      await createCategory(email, { name: name.trim(), icon, color, sort_order: cats.length });
      toast.success('Category created');
      setName('');
      onChanged();
    } catch (e) { toast.error(e?.response?.data?.error || 'Could not create the category'); }
    finally { setBusy(false); }
  };

  const saveEdit = async (c) => {
    if (!editName.trim()) { toast.error('Name can\'t be empty'); return; }
    setBusy(true);
    try {
      await updateCategory(c.id, { name: editName.trim(), icon: editIcon, color: editColor });
      toast.success('Category updated');
      setEditingId(null);
      onChanged();
    } catch (e) { toast.error(e?.response?.data?.error || 'Could not update the category'); }
    finally { setBusy(false); }
  };

  const move = async (idx, dir) => {
    const other = cats[idx + dir];
    if (!other) return;
    setBusy(true);
    try {
      await updateCategory(cats[idx].id, { sort_order: other.sort_order ?? idx + dir });
      await updateCategory(other.id, { sort_order: cats[idx].sort_order ?? idx });
      onChanged();
    } catch (e) { toast.error('Could not reorder'); }
    finally { setBusy(false); }
  };

  const remove = async (c) => {
    setBusy(true);
    try {
      await deleteCategory(c.id);
      toast.success('Category deleted — its achievements stay, now uncategorised');
      onChanged();
    } catch (e) { toast.error('Could not delete the category'); }
    finally { setBusy(false); }
  };

  const IconOf = (key) => CATEGORY_ICONS[key] || CATEGORY_ICONS.Shapes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>
            Personal organisation only — categories never change an achievement's
            verified content or its blockchain record.
          </DialogDescription>
        </DialogHeader>

        {/* Create */}
        <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
          <Label>Create a category</Label>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              placeholder="e.g. University Applications"
              className="flex-1"
            />
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger className="w-[52px] px-2"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {ICON_OPTIONS.map((k) => (
                  <SelectItem key={k} value={k}>
                    <span className="flex items-center gap-2">{React.createElement(CATEGORY_ICONS[k], { className: 'h-4 w-4' })} {k}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger className="w-[52px] px-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLOR_OPTIONS.map((k) => (
                  <SelectItem key={k} value={k}>
                    <span className={`inline-block h-3.5 w-3.5 rounded-full border ${CATEGORY_COLORS[k].split(' ').slice(0, 2).join(' ')}`} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={add} disabled={busy}><Plus className="h-4 w-4" /> Add</Button>
          </div>
        </div>

        {/* List */}
        <div className="space-y-1.5">
          {cats.map((c, idx) => {
            const editing = editingId === c.id;
            return (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
                {editing ? (
                  <>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 h-8" autoFocus />
                    <Select value={editIcon} onValueChange={setEditIcon}>
                      <SelectTrigger className="w-[48px] h-8 px-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        {ICON_OPTIONS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={editColor} onValueChange={setEditColor}>
                      <SelectTrigger className="w-[48px] h-8 px-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COLOR_OPTIONS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(c)} disabled={busy}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${CATEGORY_COLORS[c.color] || CATEGORY_COLORS.slate}`}>
                      {React.createElement(IconOf(c.icon), { className: 'h-3.5 w-3.5' })}
                    </span>
                    <span className="flex-1 text-sm text-foreground truncate">{c.name}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(idx, -1)} disabled={busy || idx === 0} aria-label="Move up"><ChevronUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(idx, 1)} disabled={busy || idx === cats.length - 1} aria-label="Move down"><ChevronDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(c.id); setEditName(c.name); setEditIcon(c.icon || 'Shapes'); setEditColor(c.color || 'slate'); }} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(c)} disabled={busy} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
            );
          })}
          {cats.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No categories yet — the starter set is created the first time you open this dashboard.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}