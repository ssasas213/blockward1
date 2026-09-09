import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Copy, Pencil, Star, Trash2 } from 'lucide-react';
import { TEMPLATE_LIST } from './templates';

/**
 * PlanBar — multiple named seating plans per class (Normal / Exam / Group work…).
 * Switch between them, create from a template, duplicate, rename, set the
 * default (exactly one) and delete. Only the default plan loads automatically.
 */
export default function PlanBar({ plans, activePlanId, canManage, onSelectPlan, onCreatePlan, onDuplicatePlan, onRenamePlan, onMakeDefault, onDeletePlan }) {
  const [dialog, setDialog] = useState(null); // 'new' | 'rename' | 'delete' | null
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('rows');
  const active = plans.find(p => p.id === activePlanId) || null;

  const openNew = () => { setName(''); setTemplate('rows'); setDialog('new'); };
  const openRename = () => { setName(active?.name || ''); setDialog('rename'); };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={activePlanId || ''}
        onChange={(e) => onSelectPlan(e.target.value)}
        className="h-9 rounded-lg bg-background border border-border px-2 text-sm text-foreground"
        aria-label="Seating plan"
      >
        {plans.length === 0 && <option value="">Default</option>}
        {plans.map(p => <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' ★' : ''}</option>)}
      </select>

      {canManage && (
        <>
          <Button variant="outline" size="sm" onClick={openNew}><Plus className="h-4 w-4" />New plan</Button>
          {active && (
            <>
              <Button variant="outline" size="sm" onClick={onDuplicatePlan}><Copy className="h-4 w-4" />Duplicate</Button>
              <Button variant="outline" size="sm" onClick={openRename}><Pencil className="h-4 w-4" />Rename</Button>
              {!active.is_default && (
                <Button variant="outline" size="sm" onClick={onMakeDefault}><Star className="h-4 w-4" />Set default</Button>
              )}
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDialog('delete')}><Trash2 className="h-4 w-4" />Delete</Button>
            </>
          )}
        </>
      )}

      <Dialog open={dialog === 'new' || dialog === 'rename'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog === 'new' ? 'New seating plan' : 'Rename seating plan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="plan-name">Plan name</Label>
              <Input
                id="plan-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Exam"
                className="mt-1.5"
                autoFocus
              />
            </div>
            {dialog === 'new' && (
              <div>
                <Label htmlFor="plan-template">Start from template</Label>
                <select
                  id="plan-template"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="mt-1.5 w-full h-10 rounded-lg bg-background border border-border px-3 text-sm text-foreground"
                >
                  {TEMPLATE_LIST.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <p className="text-xs text-muted-foreground mt-1.5">Every template starts with the teacher's desk at the front of the room.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              disabled={!name.trim()}
              onClick={() => {
                if (dialog === 'new') onCreatePlan(name.trim(), template);
                else onRenamePlan(name.trim());
                setDialog(null);
              }}
            >
              {dialog === 'new' ? 'Create plan' : 'Save name'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog === 'delete'} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{active?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The plan and its seat assignments will be removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { onDeletePlan(); setDialog(null); }}
            >
              Delete plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}