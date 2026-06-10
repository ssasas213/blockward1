/**
 * SignatureConfirmDialog — Shows the signer's saved signature profile,
 * requires a confirmation checkbox, and calls onConfirm with the snapshotted sig data.
 * Used when teacher/admin already has a SignatureProfile set up.
 */
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Shield, PenLine, Check, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function SignatureConfirmDialog({ open, onOpenChange, sigProfile, record, userType, onConfirm, disabled }) {
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (!confirmed) return;
    // Snapshot the signature profile onto this record
    onConfirm({
      type: sigProfile.signature_type,
      value: sigProfile.signature_value,
      display_name: sigProfile.display_name,
      title: sigProfile.title,
    });
  };

  if (!sigProfile) return null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!disabled) { onOpenChange(v); setConfirmed(false); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-violet-600" />
            {userType === 'admin' ? 'Sign & Approve Achievement' : 'Sign & Endorse Achievement'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Record being signed</p>
            <p className="font-semibold text-slate-800">{record?.title}</p>
            <p className="text-sm text-slate-500">{record?.student_name}</p>
          </div>

          {/* Saved signature preview */}
          <div className="p-4 border-2 border-violet-200 rounded-xl bg-violet-50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-violet-800">Your Saved Signature</p>
              <Badge className="bg-violet-100 text-violet-700 border-0 text-xs gap-1">
                <Shield className="h-3 w-3" /> {sigProfile.title}
              </Badge>
            </div>
            {sigProfile.signature_type === 'drawn' ? (
              <img src={sigProfile.signature_value} alt="Your signature" className="h-14 border rounded bg-white" />
            ) : (
              <p className="text-2xl italic text-slate-800 py-1" style={{ fontFamily: 'Georgia, serif' }}>
                {sigProfile.signature_value}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-2">{sigProfile.display_name} · {sigProfile.title}</p>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            ⚠️ This signature is <strong>permanent</strong> once applied. It cannot be edited, removed, or altered on the record.
          </div>

          {/* Confirmation checkbox */}
          <div className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl">
            <Checkbox id="confirm-sig" checked={confirmed} onCheckedChange={setConfirmed} className="mt-0.5" />
            <label htmlFor="confirm-sig" className="text-sm text-slate-700 cursor-pointer leading-snug">
              I confirm this signature authorises this {userType === 'admin' ? 'award/NFT for minting' : 'achievement for admin review'}. I have reviewed all evidence and approve this submission.
            </label>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { onOpenChange(false); setConfirmed(false); }} disabled={disabled}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              onClick={handleConfirm}
              disabled={!confirmed || disabled}
            >
              {disabled ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              {disabled ? 'Signing...' : 'Apply Signature'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}