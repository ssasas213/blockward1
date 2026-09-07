import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, PenLine } from 'lucide-react';
import { METHOD_OPTIONS, ATTESTATION_TEXT } from '@/lib/achievementRequests';

// Sign-off dialog shared by every signing step (verifier, admin, bulk, external):
// verification method, required attestation tick, and a typed signature.
export default function SignoffDialog({
  open, onOpenChange, title, description, confirmLabel, busy, onConfirm,
}) {
  const [method, setMethod] = useState('');
  const [methodNote, setMethodNote] = useState('');
  const [attestation, setAttestation] = useState(false);
  const [signature, setSignature] = useState('');

  useEffect(() => {
    if (open) {
      setMethod('');
      setMethodNote('');
      setAttestation(false);
      setSignature('');
    }
  }, [open]);

  const canConfirm = method && attestation && signature.trim() && (method !== 'other' || methodNote.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PenLine className="h-4 w-4 text-primary" /> {title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>How did you verify this?</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue placeholder="Select a verification method" /></SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {method === 'other' && (
            <div className="space-y-1.5">
              <Label>Describe your verification method</Label>
              <Textarea value={methodNote} onChange={(e) => setMethodNote(e.target.value)} rows={2} placeholder="How you confirmed this achievement" />
            </div>
          )}

          <label className="flex items-start gap-2.5 rounded-lg border border-border bg-background p-3 cursor-pointer">
            <Checkbox checked={attestation} onCheckedChange={(v) => setAttestation(v === true)} className="mt-0.5" />
            <span className="text-sm text-foreground leading-snug">{ATTESTATION_TEXT}</span>
          </label>

          <div className="space-y-1.5">
            <Label>Your signature</Label>
            <Input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Type your full name"
              className="font-serif italic"
            />
            <p className="text-xs text-muted-foreground">Typing your full name acts as your legal signature.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button
            disabled={!canConfirm || busy}
            onClick={() => onConfirm({ method, method_note: methodNote, attestation: true, signature })}
          >
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {confirmLabel || 'Sign off'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}