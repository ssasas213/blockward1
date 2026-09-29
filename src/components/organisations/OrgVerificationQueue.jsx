import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { openEvidenceFile } from '@/lib/evidenceAccess';
import {
  ClipboardCheck, Loader2, FileText, Paperclip, PenTool,
  CheckCircle2, XCircle, User, ShieldCheck,
} from 'lucide-react';

const METHODS = [
  { value: 'witnessed_in_person', label: 'I witnessed it in person' },
  { value: 'reviewed_evidence', label: 'I reviewed the evidence' },
  { value: 'official_records', label: 'I checked our official records' },
  { value: 'third_party', label: 'A third party confirmed it' },
  { value: 'other', label: 'Other' },
];

/**
 * OrgVerificationQueue — the organisation's live verification queue with the
 * review & sign screen. Signing is an explicit act: the verifier picks the
 * method, confirms the attestation and authorises their stored signature.
 */
export default function OrgVerificationQueue({ org, queue, mySignature, onChanged, onOpenSignatureSetup }) {
  const [reviewing, setReviewing] = useState(null);
  const [ready, setReady] = useState(false); // open_request recorded
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('');
  const [methodNote, setMethodNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!reviewing) return;
    setReady(false);
    setError('');
    setMethod('');
    setMethodNote('');
    setConsent(false);
    setRejectMode(false);
    setRejectReason('');
    // First reviewer marks the request as opened (server-side gate).
    base44.functions.invoke('orgAction', {
      action: 'open_request', org_id: org.id, request_id: reviewing.id,
    }).then(() => setReady(true)).catch(() => setReady(true));
  }, [reviewing]);

  if (!queue.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Verification queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <ClipboardCheck className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">No open verification requests</p>
            <p className="text-xs text-muted-foreground mt-1">
              When a holder asks {org.name} to verify an achievement, it appears here for review and signing.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const submitDecision = async () => {
    setBusy(true);
    setError('');
    try {
      const body = rejectMode
        ? { request_id: reviewing.id, org_id: org.id, action: 'reject', reason: rejectReason }
        : {
            request_id: reviewing.id, org_id: org.id, action: 'approve',
            method, method_note: methodNote, consent: true, signature_id: mySignature.id,
          };
      const res = await base44.functions.invoke('orgVerificationReview', body);
      if (!res?.data?.ok) throw new Error(res?.data?.error || 'Could not submit your decision');
      if (rejectMode) {
        toast.success('Verification declined — nothing was published');
      } else if (res.data.outcome === 'pending_more') {
        toast.success(`Signature recorded — awaiting ${Math.max(0, (reviewing.required_signatures || 1) - (res.data.signature_count ?? (reviewing.signature_count || 0) + 1))} more signature(s) before issuance`);
      } else {
        toast.success('Signed — the credential is being issued and anchored to Polygon');
      }
      setReviewing(null);
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const openEvidence = async (item, url) => {
    await openEvidenceFile({ url, achievementId: item.achievement.id });
  };

  const req = reviewing;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Verification queue
            <Badge variant="secondary">{queue.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {queue.map((item) => {
            const pendingCount = Math.max(0, (item.required_signatures || 1) - (item.signature_count || 0));
            const joint = (item.required_signatures || 1) > 1;
            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border bg-secondary/30 p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{item.achievement_title}</p>
                    <Badge variant={item.status === 'opened' ? 'info' : 'secondary'} className="capitalize">
                      {item.status}
                    </Badge>
                    {joint && (
                      <Badge variant={item.signature_count > 0 ? 'info' : 'secondary'}>
                        {item.signature_count}/{item.required_signatures} signed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <User className="inline h-3 w-3 mr-1" />
                    {item.holder_name || 'Holder'}
                    {item.achievement?.category ? ` · ${item.achievement.category}` : ''}
                    {item.created_date ? ` · requested ${new Date(item.created_date).toLocaleDateString()}` : ''}
                    {item.signed_by_me ? ' · you signed ✓' : ''}
                  </p>
                </div>
                {item.signed_by_me ? (
                  <Badge variant="success" className="gap-1 self-start sm:self-auto">
                    <CheckCircle2 className="h-3 w-3" /> Signed
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => setReviewing(item)}>
                    <PenTool className="h-4 w-4" />
                    {item.signature_count > 0 ? 'Add signature' : 'Review & sign'}
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!req} onOpenChange={(v) => { if (!busy) setReviewing(v ? req : null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {req && (
            <>
              <DialogHeader>
                <DialogTitle>Review &amp; sign</DialogTitle>
                <DialogDescription>
                  {(req.required_signatures || 1) > 1
                    ? `Joint verification — ${req.signature_count || 0} of ${req.required_signatures} required signatures collected.`
                    : 'Your signature authorises this credential for issuance and blockchain anchoring.'}
                </DialogDescription>
              </DialogHeader>

              {/* Achievement under review */}
              <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="capitalize">{req.achievement?.category || 'achievement'}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Holder: {req.holder_name || '—'}
                    {req.achievement?.date_achieved ? ` · achieved ${req.achievement.date_achieved}` : ''}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">{req.achievement?.title || req.achievement_title}</p>
                {req.achievement?.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{req.achievement.description}</p>
                )}
                {req.achievement?.external_credential_id && (
                  <p className="text-xs text-muted-foreground">Certificate ID: {req.achievement.external_credential_id}</p>
                )}

                {/* Evidence + certificate — private files open via permission-checked signed URLs */}
                {(req.achievement?.evidence?.length > 0 || req.achievement?.certificate_url) && (
                  <div className="pt-2 space-y-2">
                    <p className="text-xs font-medium text-foreground">Supporting evidence</p>
                    <div className="flex flex-wrap gap-2">
                      {req.achievement?.certificate_url && (
                        <Button
                          size="sm" variant="outline"
                          onClick={() => openEvidence(req, req.achievement.certificate_url)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {req.achievement.certificate_name || 'Certificate'}
                        </Button>
                      )}
                      {(req.achievement?.evidence || []).map((ev, i) => (
                        <Button key={i} size="sm" variant="outline" onClick={() => openEvidence(req, ev.url)}>
                          <Paperclip className="h-3.5 w-3.5" />
                          {ev.name || `Evidence ${i + 1}`}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Signatures so far (joint verification) */}
              {(req.signatures || []).length > 0 && (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-medium text-foreground mb-2">
                    Signatures collected ({req.signature_count || req.signatures.length}/{req.required_signatures || 1})
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {req.signatures.map((s, i) => (
                      <div key={i} className="rounded-lg border border-border bg-secondary/30 p-2 text-center">
                        <img src={s.signature_image_url} alt={`Signature of ${s.verifier_name}`} className="h-8 rounded bg-white px-2" />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {s.verifier_name}{s.verifier_title ? `, ${s.verifier_title}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {req.signed_by_me ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" /> You have already signed this verification.
                </p>
              ) : !mySignature ? (
                <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-warning" /> Signature setup required
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Set up your verifier signature first — then come back to sign this verification.
                  </p>
                  <Button size="sm" className="mt-2" onClick={() => { setReviewing(null); onOpenSignatureSetup?.(); }}>
                    <PenTool className="h-4 w-4" /> Set up my signature
                  </Button>
                </div>
              ) : rejectMode ? (
                <div className="space-y-2">
                  <Label>Why can't {org.name} verify this achievement?</Label>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. We have no record of this achievement"
                    rows={3}
                  />
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setRejectMode(false)}
                  >
                    Back to approving
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>How did you verify this achievement?</Label>
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger><SelectValue placeholder="Choose a verification method" /></SelectTrigger>
                      <SelectContent>
                        {METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Optional note (shown on the public credential)</Label>
                    <Input
                      value={methodNote}
                      onChange={(e) => setMethodNote(e.target.value)}
                      placeholder="e.g. Verified against our competition results database"
                      maxLength={500}
                    />
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3">
                    <img src={mySignature.image_url} alt="My signature" className="h-10 rounded bg-white px-2" />
                    <span className="text-xs text-muted-foreground">This stored signature will be applied.</span>
                  </div>
                  <label className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-3 cursor-pointer">
                    <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      I confirm this achievement is accurate and verified by {org.name}, and I explicitly authorise
                      my signature to be applied to this credential.
                    </span>
                  </label>
                </div>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}

              <DialogFooter className="gap-2 sm:gap-0">
                {!req.signed_by_me && !rejectMode && mySignature && (
                  <Button variant="ghost" className="text-destructive" onClick={() => setRejectMode(true)} disabled={busy}>
                    <XCircle className="h-4 w-4" /> Cannot verify
                  </Button>
                )}
                <Button variant="outline" onClick={() => setReviewing(null)} disabled={busy}>Close</Button>
                {!req.signed_by_me && mySignature && (
                  <Button
                    onClick={submitDecision}
                    disabled={busy || !ready || (rejectMode ? !rejectReason.trim() : (!method || !consent))}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {rejectMode ? 'Confirm decline' : 'Approve & sign'}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Imported late to avoid a name clash with the JSX icon set above.
import { ShieldAlert } from 'lucide-react';