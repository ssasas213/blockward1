import React from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, AlertTriangle, FileText, LinkIcon, ChevronRight, Users, ShieldCheck } from 'lucide-react';
import { STATUS_LABELS, STATUS_BADGE_VARIANTS, TIER_SHORT, CATEGORY_LABELS } from '@/lib/achievementRequests';

/**
 * PendingTab — the student's AchievementRequests list, carried over unchanged
 * from the My achievement requests page: statuses, reviewer comments,
 * evidence, activity log, and edit & resubmit.
 */
export default function PendingTab({ requests, caps, onEdit, loading = false }) {
  if (loading) {
    return (
      <div className="space-y-3" aria-hidden="true">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-24 rounded-xl border border-border bg-card/60 animate-pulse" />
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

      <div className="space-y-3">
        {requests.map((r) => (
          <Card key={r.id} className="border-border bg-card/60 backdrop-blur-md shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">{r.title}</h3>
                    <Badge variant={STATUS_BADGE_VARIANTS[r.status] || 'secondary'}>{STATUS_LABELS[r.status] || r.status}</Badge>
                    <Badge variant="outline">{TIER_SHORT[r.verification_tier] || 'Tier ?'}</Badge>
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
                  {['minted', 'archived'].includes(r.status) && r.verification_id && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/verify/${r.verification_id}`}>
                        <ShieldCheck className="h-4 w-4 mr-1.5" /> View credential
                      </Link>
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

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Verifier: {r.nominated_verifier_name || r.nominated_verifier_email}</span>
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
        ))}
      </div>
    </div>
  );
}