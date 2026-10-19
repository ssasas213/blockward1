import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import BrandHeader from '@/components/public/BrandHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Loader2, ShieldCheck, FileText, Link2, Info, FlaskConical, MessageSquare } from 'lucide-react';

/**
 * Historical verification — the APPROVED verifier's confirmation page.
 * Reached only through a single-use, expiring link sent after Blockward's
 * Super Admin authorised this specific verifier. The verifier confirms their
 * identity and authority, then decides. No Blockward account needed.
 */
export default function HistoricalVerifier() {
  const { token } = useParams();
  const [state, setState] = useState('loading'); // loading|ready|invalid|expired|used|done
  const [reason, setReason] = useState(null);
  const [req, setReq] = useState(null);
  const [identity, setIdentity] = useState(false);
  const [authority, setAuthority] = useState(false);
  const [nameConfirm, setNameConfirm] = useState('');
  const [method, setMethod] = useState(null);
  const [note, setNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState(null); // { status, bw_id }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('historicalVerifierData', { token });
        if (!alive) return;
        if (res.data?.ok) { setReq(res.data.request); setState('ready'); }
        else { setReason(res.data?.error || 'This link is not valid'); setState(res.data?.reason || 'invalid'); }
      } catch (e) {
        if (!alive) return;
        setReason(e?.response?.data?.error || 'This link is not valid');
        setState(e?.response?.data?.reason || 'invalid');
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const act = async (action) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('historicalVerifierAction', {
        token, action,
        identity_confirmed: identity, authority_confirmed: authority,
        full_name_confirm: nameConfirm, method, note: note || undefined, reason: rejectReason || undefined,
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not submit');
      if (action === 'request_info') { toast.success('Request sent to the student'); setNote(''); }
      else { setDecision({ status: res.data.status, bw_id: res.data.bw_id, demo: !!res.data.demo }); setState('done'); }
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Could not submit');
    } finally { setBusy(false); }
  };

  const ready = req && state === 'ready' && identity && authority && nameConfirm.trim().toLowerCase() === String(req.expected_name || '').toLowerCase();

  return (
    <div className="min-h-screen bg-background">
      <BrandHeader />
      <div className="max-w-2xl mx-auto px-4 py-10">
        {state === 'loading' && (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>
        )}

        {['invalid', 'expired', 'used'].includes(state) && (
          <Card className="surface-card"><CardContent className="py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4"><XCircle className="h-6 w-6 text-destructive" /></div>
            <h1 className="text-lg font-semibold text-foreground">
              {state === 'expired' ? 'This link has expired' : state === 'used' ? 'This link has already been used' : 'This link is not valid'}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              {state === 'used'
                ? 'A decision was already submitted for this request — each link works once.'
                : 'Each verification link is single-use and time-limited. The student can request a fresh verification from their Vault.'}
            </p>
          </CardContent></Card>
        )}

        {state === 'done' && (
          <Card className="surface-card"><CardContent className="py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="h-6 w-6 text-success" /></div>
            <h1 className="text-lg font-semibold text-foreground">Response recorded</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              {decision?.status === 'verifier_declined' && <>Your response was recorded and the student has been notified. No credential was issued.</>}
              {decision?.status === 'verifier_confirmed' && <>Thank you — the achievement is confirmed. The demo Super Admin can now issue the synthetic demo credential.</>}
              {decision?.status === 'issued' && <>Thank you — the student has been notified and a Blockward Verified credential {decision?.bw_id ? `(${decision.bw_id})` : ''} has been issued.</>}
            </p>
          </CardContent></Card>
        )}

        {state === 'ready' && req && (
          <div className="space-y-5">
            {req.demo && (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
                <FlaskConical className="h-4 w-4 text-warning flex-shrink-0" />
                <p className="text-xs font-semibold text-foreground">TEST MODE — simulated verification request. Nothing real is issued and no real email is sent.</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-tertiary">Blockward historical verification · {req.request_ref}</p>
              <h1 className="text-2xl font-bold text-foreground mt-1">{req.achievement.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Awarded by <span className="text-foreground font-medium">{req.achievement.issuing_org}</span> on {req.achievement.original_date}.
                Blockward's review team authorised you to verify this specific request.
              </p>
            </div>

            {req.achievement.description && (
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <p className="text-xs font-semibold text-foreground mb-1">What {req.student_first_name} submitted</p>
                <p className="text-sm text-muted-foreground">{req.achievement.description}</p>
                {req.achievement.certificate_ref && <p className="text-xs text-tertiary mt-2">Certificate reference: {req.achievement.certificate_ref}</p>}
              </div>
            )}

            <div className="rounded-xl border border-border bg-card/40 p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">Evidence ({req.evidence.length})</p>
              {req.evidence.length === 0 && <p className="text-xs text-muted-foreground">No evidence was attached.</p>}
              {req.evidence.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {e.kind === 'link' ? <Link2 className="h-3.5 w-3.5 text-primary flex-shrink-0" /> : <FileText className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                  <span className="flex-1 truncate text-foreground">{e.name}</span>
                  <Button size="sm" variant="outline" asChild>
                    <a href={e.kind === 'link' ? e.url : e.signed_url} target="_blank" rel="noopener noreferrer">Open</a>
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info/5 p-3">
              <Info className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">You are being asked because {req.student_first_name} nominated you as someone authorised by {req.achievement.issuing_org}. Your response applies to this request only and is timestamped for the audit trail.</p>
            </div>

            <Card className="surface-card">
              <CardContent className="p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-success" /> Confirm your identity and authority</p>
                <div className="flex items-start gap-2.5">
                  <Checkbox id="identity" checked={identity} onCheckedChange={(v) => setIdentity(v === true)} className="mt-0.5" />
                  <Label htmlFor="identity" className="text-xs font-normal text-muted-foreground cursor-pointer">I confirm that I am {req.verifier.name} ({req.verifier.role} at {req.verifier.org}), and that I am submitting this response myself.</Label>
                </div>
                <div className="flex items-start gap-2.5">
                  <Checkbox id="authority" checked={authority} onCheckedChange={(v) => setAuthority(v === true)} className="mt-0.5" />
                  <Label htmlFor="authority" className="text-xs font-normal text-muted-foreground cursor-pointer">I confirm I am authorised by {req.achievement.issuing_org} to verify achievements like this one.</Label>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type your full name to confirm your identity</Label>
                  <Input value={nameConfirm} onChange={(e) => setNameConfirm(e.target.value)} placeholder={req.expected_name} />
                </div>
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardContent className="p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground">Is this achievement authentic?</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">How did you verify it?</Label>
                  <Select value={method || ''} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue placeholder="Select a method" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="witnessed_in_person">I witnessed it in person</SelectItem>
                      <SelectItem value="reviewed_evidence">I reviewed the evidence provided</SelectItem>
                      <SelectItem value="official_records">I checked official records</SelectItem>
                      <SelectItem value="third_party">A third party confirmed it to me</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Optional note</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Anything you would like recorded with the credential" />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Button disabled={!ready || busy || !method} onClick={() => act('confirm')} className="flex-1">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm authentic
                  </Button>
                  <Button variant="outline" disabled={busy || !rejectReason.trim()} onClick={() => act('cannot_verify')} className="flex-1">
                    <XCircle className="h-4 w-4" /> I cannot verify this
                  </Button>
                  <Button variant="ghost" disabled={busy || !note.trim()} onClick={() => act('request_info')} className="flex-1">
                    <MessageSquare className="h-4 w-4" /> Ask for more information
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">If you cannot verify — required reason</Label>
                  <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={1000} placeholder="Briefly explain why (sent to the student)" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}