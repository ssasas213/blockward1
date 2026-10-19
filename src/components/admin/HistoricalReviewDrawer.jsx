import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { X, FileText, Link2, Flag, ShieldCheck, ShieldX, MessageSquare, Ban, Award } from 'lucide-react';

const ACTION_STYLE = 'inline-flex items-center gap-1.5';

/** Super Admin review panel — student info, achievement info, proposed
 *  verifier, security-review context, and the four audited actions. Approving
 *  a verifier REQUIRES a recorded authority-review summary. */
export default function HistoricalReviewDrawer({ detail, loading, busy, onClose, onAction }) {
  const [notes, setNotes] = useState('');
  const [flags, setFlags] = useState('');
  const [reason, setReason] = useState('');
  const r = detail?.request;
  if (!r) return null;
  const ctx = detail?.context || {};

  const doAction = (action) => {
    const payload = { action, request_id: r.id };
    if (action === 'approve_verifier') {
      if (notes.trim().length < 20) return;
      payload.authority_notes = notes.trim();
      payload.flags = flags.split(',').map((f) => f.trim()).filter(Boolean);
    } else { payload.reason = action === 'request_info' ? reason.trim() : reason.trim(); }
    onAction(payload, () => { setNotes(''); setFlags(''); setReason(''); });
  };

  const canApprove = ['pending_review', 'info_requested', 'verifier_rejected'].includes(r.status);
  const Row = ({ label, value }) => (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs font-medium text-tertiary sm:w-48 flex-shrink-0">{label}</span>
      <span className="text-sm text-foreground break-words">{value || '—'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-card border-l border-border shadow-2xl overflow-y-auto">
        <div className="sticky top-0 glass border-b border-border px-5 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{r.title}</p>
            <p className="text-xs text-tertiary">{r.request_ref} · {String(r.status).replace(/_/g, ' ')}{r.demo ? ' · DEMO' : ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-hover rounded-md" aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center"><div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Student information */}
            <section className="space-y-1">
              <p className="section-heading">Student information</p>
              <Row label="Name" value={r.student_name} />
              <Row label="Account" value={r.student_email} />
              <Row label="LinkedIn" value={r.linkedin_url ? <a href={r.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{r.linkedin_url}</a> : null} />
              <Row label="Website" value={r.personal_website} />
              <Row label="Verified credentials" value={ctx.student_verified_credentials != null ? `${ctx.student_verified_credentials}` : null} />
              <Row label="Other historical requests" value={ctx.student_other_requests != null ? `${ctx.student_other_requests} (${ctx.student_open_requests || 0} open)` : null} />
            </section>

            {/* Achievement information */}
            <section className="space-y-1">
              <p className="section-heading">Achievement information</p>
              <Row label="Title" value={r.title} />
              <Row label="Original date" value={r.original_date} />
              <Row label="Issuing organisation" value={r.issuing_org} />
              <Row label="Country" value={r.country} />
              <Row label="Certificate reference" value={r.certificate_ref} />
              <Row label="Description" value={r.description} />
            </section>

            {/* Evidence */}
            <section className="space-y-2">
              <p className="section-heading">Evidence ({(detail?.evidence || []).length})</p>
              <div className="space-y-1.5">
                {(detail?.evidence || []).map((e, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm">
                    {e.kind === 'link' ? <Link2 className="h-3.5 w-3.5 text-primary flex-shrink-0" /> : <FileText className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                    <span className="flex-1 truncate text-foreground">{e.name}</span>
                    {e.kind === 'link' && <Button size="sm" variant="outline" asChild><a href={e.url} target="_blank" rel="noopener noreferrer">Open</a></Button>}
                    {e.kind === 'file' && e.signed_url && <Button size="sm" variant="outline" asChild><a href={e.signed_url} target="_blank" rel="noopener noreferrer">View</a></Button>}
                    {e.kind === 'file' && !e.signed_url && <span className="text-xs text-destructive">Unavailable</span>}
                  </div>
                ))}
              </div>
            </section>

            {/* Proposed verifier */}
            <section className="space-y-1">
              <p className="section-heading">Proposed verifier</p>
              <Row label="Name" value={r.verifier_name} />
              <Row label="Email" value={r.verifier_email} />
              <Row label="Role" value={r.verifier_role} />
              <Row label="Organisation" value={r.verifier_org} />
              <Row label="LinkedIn" value={r.verifier_linkedin} />
              <Row label="Relationship" value={r.verifier_relationship} />
              <Row label="Claimed authority" value={r.verifier_authority_claim} />
              <Row label="Nominations on this request" value={r.verifier_proposals ? `${r.verifier_proposals}` : null} />
            </section>

            {/* Security review */}
            <section className="space-y-2">
              <p className="section-heading">Security review</p>
              {(ctx.potential_flags || []).length > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-1.5">
                  {(ctx.potential_flags || []).map((f, i) => (
                    <p key={i} className="text-xs text-foreground flex items-start gap-1.5"><Flag className="h-3.5 w-3.5 text-warning mt-0.5 flex-shrink-0" />{f}</p>
                  ))}
                </div>
              )}
              {(ctx.verifier_other_requests || []).length > 0 && (
                <div className="rounded-lg border border-border bg-card/50 p-3">
                  <p className="text-xs font-medium text-foreground mb-1">Same verifier email on other requests</p>
                  {ctx.verifier_other_requests.map((x, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground">{x.request_ref} · {x.title} · {String(x.status).replace(/_/g, ' ')}</p>
                  ))}
                </div>
              )}
              {r.authority_review && (
                <div className="rounded-lg border border-success/25 bg-success/5 p-3 space-y-1">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Authority review by {r.authority_review.reviewed_by}</p>
                  <p className="text-xs text-muted-foreground">{r.authority_review.checks}</p>
                  {(r.authority_review.flags || []).length > 0 && <p className="text-xs text-warning">Flags: {r.authority_review.flags.join(', ')}</p>}
                </div>
              )}
              <p className="text-xs text-muted-foreground">A LinkedIn profile or a professional-looking email alone is never sufficient. An inbox link proves control of the inbox, not the truth of the achievement.</p>
            </section>

            {/* Actions */}
            {['issued', 'withdrawn', 'rejected'].includes(r.status) ? (
              <div className="rounded-xl border border-border bg-card/50 p-3 text-xs text-muted-foreground">
                This request is {String(r.status).replace(/_/g, ' ')} — no further Super Admin actions.{r.demo_credential?.bw_id ? <> Demo credential {r.demo_credential.bw_id}.</> : null}{r.credential_bw_id ? <> Credential {r.credential_bw_id}.</> : null}
              </div>
            ) : (
              <section className="space-y-3 border-t border-border pt-4">
                <p className="section-heading">Super Admin actions</p>
                {r.demo && (
                  r.status === 'verifier_confirmed' ? (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => doAction('issue_demo_credential')}>
                      <Award className="h-3.5 w-3.5" /> Issue demo credential (TEST MODE — no real credential)
                    </Button>
                  ) : null
                )}
                {canApprove && !r.demo && (
                  <div className="space-y-2 rounded-xl border border-border bg-card/50 p-3">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Approve verifier — authority review (required)</Label>
                    <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="The independent checks you performed: organisation website, official records, independently obtained contact details, org administrator confirmation, documented appointment..." maxLength={2000} />
                    <Input value={flags} onChange={(e) => setFlags(e.target.value)} placeholder="Flags (comma-separated, optional) — e.g. shares surname with student" maxLength={200} />
                    <Button size="sm" disabled={busy || notes.trim().length < 20} onClick={() => doAction('approve_verifier')}>
                      <ShieldCheck className="h-3.5 w-3.5" /> Authorise verifier (single-use 72h link)
                    </Button>
                  </div>
                )}
                <div className="space-y-2 rounded-xl border border-border bg-card/50 p-3">
                  <Label className="text-xs font-semibold text-foreground">Reason / message (required for reject and info requests)</Label>
                  <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000}
                    placeholder="Recorded reason — kept in the audit trail" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={() => doAction('reject_verifier')}>
                      <ShieldX className="h-3.5 w-3.5" /> Reject verifier
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={() => doAction('request_info')}>
                      <MessageSquare className="h-3.5 w-3.5" /> Request more information
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busy || !reason.trim()} onClick={() => doAction('reject_request')}>
                      <Ban className="h-3.5 w-3.5" /> Reject request
                    </Button>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}