import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Shield, ShieldCheck, FileText, LinkIcon, Clock, XCircle } from 'lucide-react';
import { METHOD_OPTIONS, ATTESTATION_TEXT, CATEGORY_LABELS } from '@/lib/achievementRequests';

// Public, token-authenticated page where a Tier 3 external verifier
// (examiner, referee, federation officer, event organiser) confirms an
// achievement — no BlockWard account needed.
export default function ExternalVerify() {
  const { token } = useParams();
  const [state, setState] = useState('loading'); // loading | form | error | success
  const [request, setRequest] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ name: '', role: '', organisation: '', email: '', method: '', methodNote: '', attestation: false, signature: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    base44.functions.invoke('achievementRequestAction', { action: 'external_get', token })
      .then((res) => {
        if (res.data?.ok) { setRequest(res.data.request); setState('form'); }
        else { setError(res.data?.error || 'This verification link is invalid.'); setState('error'); }
      })
      .catch(() => { setError('This verification link is invalid.'); setState('error'); });
  }, [token]);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('achievementRequestAction', {
        action: 'external_confirm', token,
        name: form.name, role: form.role, organisation: form.organisation, email: form.email,
        method: form.method, method_note: form.methodNote, attestation: form.attestation === true,
        signature: form.signature,
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Verification failed');
      setRequest((r) => ({ ...r, verification_id: res.data.verification_id }));
      setState('success');
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
      setState('error');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = form.name.trim() && form.role.trim() && form.organisation.trim() &&
    form.email.includes('@') && form.method && form.attestation === true && form.signature.trim() &&
    (form.method !== 'other' || form.methodNote.trim());

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">External verification</h1>
          <p className="text-sm text-muted-foreground mt-1.5">BlockWard — verified achievements</p>
        </div>

        {state === 'loading' && (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        )}

        {state === 'error' && (
          <Card className="border-border bg-card/60 backdrop-blur-md">
            <CardContent className="p-8 text-center">
              <XCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
              <p className="text-foreground font-medium">We can't verify with this link</p>
              <p className="text-sm text-muted-foreground mt-1.5">{error}</p>
            </CardContent>
          </Card>
        )}

        {state === 'success' && (
          <Card className="border-border bg-card/60 backdrop-blur-md">
            <CardContent className="p-8 text-center">
              <ShieldCheck className="h-10 w-10 text-success mx-auto mb-4" />
              <h2 className="text-lg font-bold text-foreground">Thank you — verification complete</h2>
              <p className="text-sm text-muted-foreground mt-2">
                You've confirmed <strong className="text-foreground">{request?.title}</strong> for {request?.student_name}.
                The credential is now published on their profile with your details in its verification chain.
              </p>
              {request?.verification_id && (
                <p className="text-xs text-muted-foreground mt-3">Verification ID: {request.verification_id}</p>
              )}
            </CardContent>
          </Card>
        )}

        {state === 'form' && request && (
          <>
            {/* Request summary */}
            <Card className="border-border bg-card/60 backdrop-blur-md mb-4">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-foreground">{request.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {request.student_name} · {request.credential_type_title}
                  {request.category && ` · ${CATEGORY_LABELS[request.category] || request.category}`}
                </p>
                {request.description && <p className="text-sm text-foreground/80 mt-3">{request.description}</p>}
                {request.date_achieved && (
                  <p className="text-xs text-muted-foreground mt-2">Achieved {new Date(request.date_achieved).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                )}
                {(request.evidence || []).length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {request.evidence.map((e, i) => (
                      <a key={i} href={e.url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground hover:bg-hover transition-colors">
                        {e.type === 'file' ? <FileText className="h-3.5 w-3.5 text-primary" /> : <LinkIcon className="h-3.5 w-3.5 text-primary" />}
                        {e.name}
                      </a>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Internally verified by {request.nominated_verifier_name}. This one-time link expires{' '}
                  {new Date(request.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.
                </p>
              </CardContent>
            </Card>

            {/* Your details */}
            <Card className="border-border bg-card/60 backdrop-blur-md">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-foreground text-sm">Your details as external verifier</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Full name</Label>
                    <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sarah Chen" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Input value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="e.g. Head referee" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Organisation</Label>
                    <Input value={form.organisation} onChange={(e) => set('organisation', e.target.value)} placeholder="e.g. National Athletics Federation" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.org" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>How did you verify this?</Label>
                  <Select value={form.method} onValueChange={(v) => set('method', v)}>
                    <SelectTrigger><SelectValue placeholder="Select a verification method" /></SelectTrigger>
                    <SelectContent>
                      {METHOD_OPTIONS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.method === 'other' && (
                  <div className="space-y-1.5">
                    <Label>Describe your verification method</Label>
                    <Input value={form.methodNote} onChange={(e) => set('methodNote', e.target.value)} />
                  </div>
                )}

                <label className="flex items-start gap-2.5 rounded-lg border border-border bg-background p-3 cursor-pointer">
                  <Checkbox checked={form.attestation} onCheckedChange={(v) => set('attestation', v === true)} className="mt-0.5" />
                  <span className="text-sm text-foreground leading-snug">{ATTESTATION_TEXT}</span>
                </label>

                <div className="space-y-1.5">
                  <Label>Your signature</Label>
                  <Input value={form.signature} onChange={(e) => set('signature', e.target.value)} placeholder="Type your full name" className="font-serif italic" />
                </div>

                <Button className="w-full" size="lg" disabled={!canSubmit || busy} onClick={submit}>
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                  Confirm & verify this achievement
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}