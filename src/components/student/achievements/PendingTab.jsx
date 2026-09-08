import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, AlertTriangle, FileText, LinkIcon, ChevronRight, Users, ShieldCheck, X, Copy, Loader2 } from 'lucide-react';
import { STATUS_LABELS, STATUS_BADGE_VARIANTS, TIER_SHORT, CATEGORY_LABELS } from '@/lib/achievementRequests';

// The student may cancel any of these; anything past this point is verified
// (or terminal) and cannot be silently unmade.
const WITHDRAWABLE = ['draft', 'submitted', 'under_review', 'changes_requested', 'awaiting_external_verification'];

/**
 * PendingTab — the student's AchievementRequests list: statuses, reviewer
 * comments, evidence, activity log, edit & resubmit, and withdraw. Withheld
 * records (withdrawn) leave the list and the Pending count by default and
 * are viewable behind a "Show withdrawn" toggle — each one can be
 * duplicated into a fresh draft so the student can correct and resubmit
 * without retyping everything.
 */
export default function PendingTab({ requests, caps, onEdit, onWithdraw, onDuplicate, onRetry, loading = false }) {
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  if (loading) {
    return (
      <div className="space-y-3" aria-hidden="true">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No requests yet"
        description="Won something, finished a grading, or took on a role? Ask your organisation to verify it — it'll be published to your profile with a full verification chain."
      />
    );
  }

  const withdrawnCount = requests.filter(r => r.status === 'withdrawn').length;
  const visible = showWithdrawn ? requests : requests.filter(r => r.status !== 'withdrawn');

  // Withdrawable: the pre-verification states, plus verified-but-unpublished
  // (a failed mint) — no public credential exists to unmake.
  const canWithdraw = (r) => WITHDRAWABLE.includes(r.status)
    || (r.status === 'approved' && !r.verification_id);

  const doRetry = async (r) => {
    setBusyId(r.id);
    try { await onRetry(r); } finally { setBusyId(null); }
  };

  const doWithdraw = async (r) => {
    setBusyId(r.id);
    try {
      await onWithdraw(r);
      setConfirmId(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {caps && !caps.can_submit && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm text-foreground">
            <p className="font-medium">Request limit reached</p>
            <p className="text-muted-foreground mt-0.5">
              You can have {caps.open_limit} open requests and submit {caps.weekly_limit} per organisation each week.
              Wait for a review, or for next week.
            </p>
          </div>
        </div>
      )}

      {withdrawnCount > 0 && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            checked={showWithdrawn}
            onChange={(e) => setShowWithdrawn(e.target.checked)}
            className="accent-primary"
          />
          Show withdrawn ({withdrawnCount})
        </label>
      )}

      <div className="space-y-3">
        {visible.map((r) => {
          const confirming = confirmId === r.id;
          return (
            <Card key={r.id} className="border-border bg-card shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{r.title}</h3>
                      <Badge variant={STATUS_BADGE_VARIANTS[r.status] || 'secondary'}>{STATUS_LABELS[r.status] || r.status}</Badge>
                      {r.verification_mode !== 'independent' && (
                        <Badge variant="outline">{TIER_SHORT[r.verification_tier] || 'Tier ?'}</Badge>
                      )}
                      {r.is_team && (
                        <Badge variant="outline" className="gap-1">
                          <Users className="h-3 w-3" />Team · {(r.team_participants || []).length + 1} people
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {r.credential_type_title} · {CATEGORY_LABELS[r.category] || r.category} · {r.school_name}
                      {r.date_achieved && ` · achieved ${new Date(r.date_achieved).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {['draft', 'changes_requested'].includes(r.status) && (
                      <Button
                        size="sm" variant="outline"
                        onClick={() => onEdit(r)}
                      >
                        {r.status === 'draft' ? 'Edit & submit' : 'Edit & resubmit'}
                      </Button>
                    )}
                    {r.status === 'approved' && !r.verification_id && (
                      <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => doRetry(r)}>
                        {busyId === r.id
                          ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          : <ShieldCheck className="h-4 w-4 mr-1.5" />}
                        Finish publishing
                      </Button>
                    )}
                    {['minted', 'archived'].includes(r.status) && r.verification_id && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/verify/${r.verification_id}`}>
                          <ShieldCheck className="h-4 w-4 mr-1.5" /> View credential
                        </Link>
                      </Button>
                    )}
                    {canWithdraw(r) && !confirming && (
                      <Button
                        size="sm" variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmId(r.id)}
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> Withdraw
                      </Button>
                    )}
                    {confirming && (
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="destructive" disabled={busyId === r.id} onClick={() => doWithdraw(r)}>
                          {busyId === r.id && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                          Yes, withdraw
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
                      </div>
                    )}
                    {r.status === 'withdrawn' && (
                      <Button size="sm" variant="outline" onClick={() => onDuplicate(r)}>
                        <Copy className="h-3.5 w-3.5 mr-1.5" /> Duplicate
                      </Button>
                    )}
                  </div>
                </div>

                {r.status === 'changes_requested' && (
                  <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
                    <p className="text-xs font-semibold text-warning uppercase tracking-wide">Your verifier asked for changes</p>
                    <p className="text-sm text-foreground mt-1">{r.changes_requested_reason}</p>
                  </div>
                )}
                {r.status === 'rejected' && (
                  <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Not approved — this stays private to you</p>
                    <p className="text-sm text-foreground mt-1">{r.rejection_reason}</p>
                  </div>
                )}
                {r.status === 'expired' && (
                  <p className="text-xs text-muted-foreground mt-3">This request expired without a reviewer responding within 30 days. You can submit it again.</p>
                )}
                {r.status === 'approved' && !r.verification_id && (
                  <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-sm text-muted-foreground">
                      Your verifier signed off. Publishing to your profile — if it doesn't finish shortly, retry or withdraw it.
                    </p>
                  </div>
                )}
                {r.status === 'withdrawn' && (
                  <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-sm text-muted-foreground">
                      You withdrew this request — it left every review queue and its verifier link was invalidated.
                      Duplicate it to fix the details and send it again.
                    </p>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Verifier: {r.nominated_verifier_name || r.nominated_verifier_email
                      || r.independent_verifier?.name
                      || (r.verification_mode === 'independent' ? 'Independent verifier' : '—')}
                  </span>
                  {r.submitted_at && <span>Submitted {new Date(r.submitted_at).toLocaleDateString('en-GB')}</span>}
                  {(r.evidence || []).length > 0 && (
                    <span className="flex items-center gap-1.5">
                      {(r.evidence || []).map((e, i) => (
                        <a key={i} href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          {e.type === 'file' ? <FileText className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
                          {e.name}
                        </a>
                      ))}
                    </span>
                  )}
                </div>

                {(r.event_log || []).length > 0 && (
                  <details className="mt-3 group">
                    <summary className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1 list-none">
                      <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                      Activity ({(r.event_log || []).length})
                    </summary>
                    <ul className="mt-2 space-y-1 border-l border-border pl-3">
                      {[...(r.event_log || [])].reverse().slice(0, 8).map((ev, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          <span className="text-foreground">{ev.actor_name || 'BlockWard'}</span>{' '}
                          {ev.event.replace(/_/g, ' ')}
                          <span className="ml-1">· {new Date(ev.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          {ev.note && <span className="block text-muted-foreground/80 italic">{ev.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}