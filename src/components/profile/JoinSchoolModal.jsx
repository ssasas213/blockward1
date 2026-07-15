import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function JoinSchoolModal({ open, onClose, onJoined, roleType }) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { status, message, school_name }

  const submit = async () => {
    if (!code.trim()) {
      toast.error('Please enter a school code');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('joinSchoolByCode', {
        code: code.trim(),
        role_type: roleType,
      });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      setResult(data);
      toast.success(data.message || 'Success');
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to join school';
      setResult({ error: msg });
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    setCode('');
    setResult(null);
    if (onClose) onClose();
    if (result?.success && onJoined) onJoined(result);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <KeyRound className="h-4 w-4 text-primary" />
            Join a School
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter the school code provided by your administrator.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-4 space-y-3">
            {result.error ? (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Could not join</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{result.error}</p>
                </div>
              </div>
            ) : result.status === 'pending' ? (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/30 bg-warning/10">
                <Clock className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Request Sent</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{result.message}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-success/30 bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Successfully Joined</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{result.message}</p>
                </div>
              </div>
            )}
            <Button onClick={close} className="w-full">
              {result.error ? 'Try Again' : 'Done'}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-foreground">School Code</Label>
                <Input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !submitting && submit()}
                  placeholder="e.g. BW-TEACHER-2024"
                  className="bg-input/50 border-border text-foreground placeholder:text-muted-foreground/60 font-mono uppercase"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {roleType === 'teacher'
                  ? 'Your request will be sent to the school administrator for approval.'
                  : roleType === 'student'
                    ? 'You will be linked to the school immediately. Use a class code to join a class.'
                    : 'Admin access requests require approval from the school owner.'}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={submitting}>Cancel</Button>
              <Button onClick={submit} disabled={submitting || !code.trim()}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Join School
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}