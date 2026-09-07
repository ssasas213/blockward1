import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { Quote, CheckCircle2, Copy, Loader2 } from 'lucide-react';

const MIN_CHARS = 20;
const MAX_CHARS = 200;

/**
 * EndorseDialog — one place to spend an endorsement.
 *  - mode 'achievement': endorsing a specific verified achievement (registry_id).
 *  - mode 'invite': endorsing someone without a BlockWard account via
 *    email/phone — the growth loop.
 * All rules (budget, eligibility, caps, 20–200 chars) are enforced server-side;
 * the dialog just surfaces the error messages.
 */
export default function EndorseDialog({ open, onOpenChange, achievement, mode = 'achievement', onDone }) {
  const [text, setText] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [inviteePhone, setInviteePhone] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setText('');
      setInviteeEmail('');
      setInviteePhone('');
      setTitle('');
      setError(null);
      setSuccess(null);
      setCopied(false);
    }
  }, [open]);

  const remaining = MAX_CHARS - text.trim().length;
  const valid = text.trim().length >= MIN_CHARS && (mode === 'achievement' || title.trim() || inviteeEmail.trim() || inviteePhone.trim());

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = mode === 'achievement'
        ? { action: 'endorse', registry_id: achievement?.registry_id, text: text.trim() }
        : {
            action: 'invite',
            invitee_email: inviteeEmail.trim() || null,
            invitee_phone: inviteePhone.trim() || null,
            achievement_title: title.trim(),
            text: text.trim(),
          };
      const res = await base44.functions.invoke('endorsementAction', payload);
      if (res.data?.ok) {
        setSuccess(res.data);
        onDone?.(res.data);
      } else {
        setError(res.data?.error || 'Something went wrong.');
      }
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(success.invite.claim_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {success ? (
          <div className="py-4 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Endorsement spent</p>
              <p className="text-sm text-muted-foreground mt-1">
                {success.remaining} of {success.budget} left this term.
              </p>
            </div>
            {success.invite && (
              <div className="rounded-xl border border-border bg-secondary/40 p-4 text-left space-y-2">
                {success.invite.channel === 'phone' || success.invite.email_status === 'failed' ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {success.invite.channel === 'phone'
                        ? 'No SMS yet — send them this link yourself:'
                        : "Email delivery failed — share this link with them instead:"}
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-[11px] text-foreground bg-background border border-border rounded-lg px-2 py-1.5 truncate">{success.invite.claim_url}</code>
                      <Button size="sm" variant="outline" onClick={copyLink}>
                        {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    They've been emailed — the endorsement waits on their profile until they claim it.
                  </p>
                )}
              </div>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Quote className="h-4 w-4 text-primary" />
                {mode === 'achievement' ? 'Endorse this achievement' : 'Endorse someone new'}
              </DialogTitle>
              <DialogDescription>
                {mode === 'achievement'
                  ? `Vouch for ${achievement?.title || 'this achievement'} — say what you personally saw. Endorsements are scarce and always carry your name.`
                  : 'Endorse someone who isn\u2019t on BlockWard yet. They\u2019ll get a claim link with this endorsement waiting.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {mode === 'invite' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="invitee-email">Their email</Label>
                      <Input id="invitee-email" type="email" placeholder="name@email.com" value={inviteeEmail} onChange={(e) => setInviteeEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="invitee-phone">or phone</Label>
                      <Input id="invitee-phone" placeholder="+44 …" value={inviteePhone} onChange={(e) => setInviteePhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-title">The achievement you saw</Label>
                    <Input id="invite-title" placeholder="e.g. the Year 9 robotics final" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="endorse-text">What you personally saw</Label>
                <Textarea
                  id="endorse-text"
                  placeholder="I watched them…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  maxLength={MAX_CHARS + 50}
                />
                <p className={`text-xs text-right ${remaining < 0 ? 'text-destructive' : text.trim().length < MIN_CHARS ? 'text-tertiary' : 'text-muted-foreground'}`}>
                  {text.trim().length}/{MAX_CHARS} · min {MIN_CHARS}
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button className="w-full" onClick={submit} disabled={!valid || submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {mode === 'achievement' ? 'Give my endorsement' : 'Send the endorsement'}
              </Button>
              <p className="text-[11px] text-tertiary text-center">
                Your name, handle and affiliation are always shown. No take-backs without revoking — slots don't roll over.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}