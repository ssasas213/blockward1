import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, XCircle, PauseCircle, MessageSquare, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { STATUS_META, TYPE_LABELS } from '@/lib/orgStatus';

/** Full organisation review screen with Approve / Reject / Suspend / Request info / Restore. */
export default function OrgReviewDrawer({ org, detail, loading, onAction, busy, onClose }) {
  const [pending, setPending] = useState(null); // { type, needsReason }
  const [reason, setReason] = useState('');
  const [confirmingApprove, setConfirmingApprove] = useState(false);

  useEffect(() => { setPending(null); setReason(''); setConfirmingApprove(false); }, [org?.id]);

  const open = !!org;
  const d = detail || {};
  const status = org?.status;

  const submit = () => {
    if (!pending) return;
    if (pending.needsReason && reason.trim().length < 4) return;
    onAction(org, pending.type, reason.trim() || null);
    setPending(null); setReason('');
  };

  const renderActions = () => (
    <div className="flex flex-wrap gap-2">
      {status !== 'verified' && (
        <Button size="sm" onClick={() => setConfirmingApprove(true)} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />} Approve
        </Button>
      )}
      {status !== 'rejected' && (
        <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setPending({ type: 'rejected', needsReason: true })} disabled={busy}>
          <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
        </Button>
      )}
      {status === 'verified' && (
        <Button size="sm" variant="outline" onClick={() => setPending({ type: 'suspended', needsReason: true })} disabled={busy}>
          <PauseCircle className="h-3.5 w-3.5 mr-1.5" /> Suspend
        </Button>
      )}
      {status === 'suspended' && (
        <Button size="sm" variant="outline" onClick={() => setPending({ type: 'pending', needsReason: false })} disabled={busy}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restore to review
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => setPending({ type: 'request_info', needsReason: true })} disabled={busy}>
        <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Request info
      </Button>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Organisation review</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-16"><div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              <div className="surface-card rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h2 className="text-lg font-bold text-foreground">{org?.name}</h2>
                  {status && <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium', (STATUS_META[status] || STATUS_META.pending).cls)}>{(STATUS_META[status] || STATUS_META.pending).label}</span>}
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <Field label="Type" value={TYPE_LABELS[org?.org_type] || (org?.org_type || 'other').replace(/_/g, ' ')} />
                  <Field label="Country" value={org?.country} />
                  <Field label="Website" value={org?.website} link />
                  <Field label="Contact email" value={org?.contact_email} />
                  <Field label="Email domain" value={org?.email_domain} />
                  <Field label="Handle" value={org?.handle ? `@${org.handle}` : null} />
                  <Field label="Owner" value={org?.owner_email} />
                  <Field label="Created" value={org?.created_date ? format(new Date(org.created_date), 'd MMM yyyy') : null} />
                  {org?.verified_at && <Field label="Verified on" value={format(new Date(org.verified_at), 'd MMM yyyy')} />}
                </dl>
                {org?.description && <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{org.description}</p>}
                {org?.claim_source === 'holder_suggestion' && (
                  <p className="text-xs text-warning mt-2">Suggested by a holder {org.suggested_by_email || ''} — awaiting a representative to claim it.</p>
                )}
              </div>

              {renderActions()}

              {/* Members */}
              {d.members?.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-tertiary mb-1.5">Members ({d.members.length})</p>
                  <div className="surface-card rounded-lg divide-y divide-border/60">
                    {d.members.map((m) => (
                      <div key={m.id} className="px-3 py-2 flex items-center justify-between text-sm">
                        <span><span className="font-medium text-foreground">{m.full_name || m.user_email}</span> <span className="text-tertiary">· {m.job_title || m.role}</span></span>
                        <span className="text-xs text-tertiary capitalize">{m.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issued credentials */}
              {d.credentials?.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-tertiary mb-1.5">Credentials issued ({d.credentials.length})</p>
                  <div className="surface-card rounded-lg divide-y divide-border/60">
                    {d.credentials.slice(0, 8).map((c) => (
                      <div key={c.id} className="px-3 py-2 flex items-center justify-between text-sm">
                        <span className="min-w-0"><span className="font-medium text-foreground">{c.bw_id}</span> <span className="text-tertiary">· {c.title}</span></span>
                        <span className="text-xs text-tertiary flex-shrink-0">{c.anchor_status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit */}
              {d.audit?.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-tertiary mb-1.5">Audit history</p>
                  <div className="surface-card rounded-lg divide-y divide-border/60">
                    {d.audit.map((e) => (
                      <div key={e.id} className="px-3 py-2 text-xs">
                        <span className="font-medium text-foreground capitalize">{e.action}</span> · {e.previous_status} → {e.new_status}
                        <span className="text-tertiary"> · {e.admin_email} · {format(new Date(e.timestamp), 'd MMM yyyy, HH:mm')}</span>
                        {e.reason && <p className="text-tertiary mt-0.5">"{e.reason}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reason / confirm prompt */}
      <Dialog open={!!pending || confirmingApprove} onOpenChange={(v) => { if (!v) { setPending(null); setConfirmingApprove(false); setReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-base">
            {confirmingApprove ? 'Approve organisation' : pending?.type === 'rejected' ? 'Reject organisation' : pending?.type === 'suspended' ? 'Suspend organisation' : 'Request information'}
          </DialogTitle></DialogHeader>
          {pending?.needsReason && (
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">
                {pending.type === 'rejected' ? 'Record the reason this organisation is rejected.' : pending.type === 'suspended' ? 'Record the reason for suspension.' : 'Describe the information you need from the organisation.'}
              </p>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason…" />
            </div>
          )}
          {confirmingApprove && (
            <p className="text-sm text-muted-foreground">Approving grants this organisation full issuing authority. Holders of achievements awaiting organisation approval will have their credentials minted and anchored on Polygon Amoy.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setPending(null); setConfirmingApprove(false); setReason(''); }}>Cancel</Button>
            <Button
              variant={confirmingApprove ? 'default' : (pending?.type === 'rejected' ? 'destructive' : 'default')}
              onClick={() => {
                if (confirmingApprove) { onAction(org, 'verified', null); setConfirmingApprove(false); }
                else submit();
              }}
              disabled={pending?.needsReason && reason.trim().length < 4}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value, link }) {
  if (!value) return null;
  return (
    <div className="py-1">
      <dt className="text-xs text-tertiary">{label}</dt>
      <dd className="text-sm text-foreground break-all">{link && /^https:\/\//.test(value) ? <a href={value} target="_blank" rel="noreferrer" className="text-primary hover:underline">{value}</a> : value}</dd>
    </div>
  );
}