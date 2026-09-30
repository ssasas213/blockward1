import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useSchool } from '@/lib/SchoolContext';
import { loadEarnedAchievements } from '@/lib/achievementLifecycle';
import { resolveStatus, formatDate } from '@/lib/achievementStatus';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import AchievementGridSkeleton from '@/components/achievements/AchievementGridSkeleton';
import { StatusIndicator, StatusDot } from '@/components/ui/status';
import { BlockwardVerifiedMark } from '@/components/brand/BlockwardVerifiedMark';
import { Plus, ChevronRight, Building2, Clock, CheckCircle2, Share2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Greeting based on local hour. */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Compact achievement row for the overview — title, issuer, date, status. */
function OverviewAchievementRow({ item, onOpen }) {
  const st = resolveStatus(item);
  const a = item;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(a)}
      className="w-full text-left group flex items-center gap-4 py-3 border-b border-border/60 last:border-0 hover:bg-hover/40 -mx-2 px-2 rounded-md transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground text-sm truncate">{a.title}</p>
        <p className="text-xs text-tertiary truncate flex items-center gap-1.5 mt-0.5">
          <Building2 className="h-3 w-3 flex-shrink-0" />
          {a.issuer_org || 'No issuer connected'}
          {a.date_achieved && <span className="text-tertiary/70">· {formatDate(a.date_achieved)}</span>}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <StatusIndicator tone={st.tone} label={st.label} pulse={st.tone === 'amber'} />
        {a.credential?.bw_id && (
          <span className="text-[10px] text-tertiary font-mono">{a.credential.bw_id}</span>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-tertiary flex-shrink-0 group-hover:text-primary transition-colors" />
    </button>
  );
}

function HolderOverviewContent() {
  const { user, profile, testMode } = useSchool();
  const email = testMode?.isTestSuperUser && testMode.effectiveEmail ? testMode.effectiveEmail : user?.email;

  const [achievements, setAchievements] = useState(null);
  const [requests, setRequests] = useState(null);

  useEffect(() => {
    if (!user) return;
    loadEarnedAchievements()
      .then((r) => setAchievements(r.achievements || []))
      .catch(() => setAchievements([]));
    base44.functions
      .invoke('achievementRequestData', { mode: 'student' })
      .then((res) => setRequests(res?.data?.ok ? (res.data.requests || []) : []))
      .catch(() => setRequests([]));
  }, [user, email]);

  const { verified, awaiting, readyToShare, recent } = useMemo(() => {
    const list = achievements || [];
    const v = list.filter((a) => resolveStatus(a).key === 'blockward_verified');
    const aw = list.filter((a) => {
      const k = resolveStatus(a).key;
      return k === 'awaiting_issuer' || k === 'awaiting_signature' || k === 'verification_requested' || k === 'securing' || k === 'issuer_verified' || k === 'integrity_pending';
    });
    const r = v.filter((a) => a.credential?.bw_id);
    return { verified: v, awaiting: aw, readyToShare: r, recent: list.slice(0, 5) };
  }, [achievements]);

  const loading = achievements === null;
  const firstName = profile?.first_name || 'there';
  const isEmpty = !loading && achievements.length === 0 && (requests || []).length === 0;

  return (
    <div className="space-y-7 max-w-5xl">
      {/* Greeting + summary line */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">{greeting()}, {firstName}</h1>
        <p className="text-sm text-muted-foreground mt-1">Your credentials and verification activity.</p>
        {!loading && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-foreground"><span className="font-semibold tabular-nums">{achievements.length}</span> <span className="text-tertiary">achievements</span></span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground"><span className="font-semibold tabular-nums text-success">{verified.length}</span> <span className="text-tertiary">verified</span></span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground"><span className="font-semibold tabular-nums text-warning">{awaiting.length}</span> <span className="text-tertiary">awaiting verification</span></span>
            <Link to={createPageUrl('Achievements')} className="ml-auto text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
              All achievements <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="rounded-xl border border-border bg-card/40 p-8">
          <h3 className="text-base font-semibold text-foreground">No achievements yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md">
            Add an achievement to begin building your verified profile. You can request issuer verification once it's recorded.
          </p>
          <Button asChild>
            <Link to={createPageUrl('Achievements')}>
              <Plus className="h-4 w-4 mr-2" /> Add achievement
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent achievements — dominates */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card/40 p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-foreground">Recent achievements</h2>
              <Link to={createPageUrl('Achievements')} className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            </div>
            {loading ? (
              <AchievementGridSkeleton count={3} />
            ) : recent.length > 0 ? (
              <div>
                {recent.map((a) => (
                  <OverviewAchievementRow key={a.id} item={a} onOpen={() => { window.location.href = createPageUrl('Achievements'); }} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-tertiary py-6 text-center">No achievements recorded yet.</p>
            )}
          </div>

          {/* Verification activity */}
          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Verification activity</h2>
            </div>
            {requests === null ? (
              <div className="space-y-2" aria-hidden="true">
                {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-md bg-muted/60 animate-pulse" />)}
              </div>
            ) : requests.length > 0 ? (
              <div className="space-y-3">
                {requests.slice(0, 4).map((r) => (
                  <div key={r.id} className="text-sm">
                    <p className="text-foreground font-medium truncate">{r.achievement_title || r.title}</p>
                    <p className="text-xs text-tertiary truncate">{r.org_name || r.issuer_org || 'Issuer'}</p>
                    <div className="mt-1">
                      <StatusIndicator
                        tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}
                        label={r.status === 'approved' ? 'Verified' : r.status === 'rejected' ? 'Rejected' : r.status === 'opened' ? 'Opened' : 'Awaiting issuer'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-tertiary py-6 text-center">No active verification requests.</p>
            )}
          </div>

          {/* Credentials ready to share */}
          {readyToShare.length > 0 && (
            <div className="lg:col-span-3 rounded-xl border border-border bg-card/40 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Credentials ready to share</h2>
                <Link to={createPageUrl('StudentBlockWards')} className="text-xs font-medium text-primary hover:underline">
                  All credentials
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {readyToShare.slice(0, 6).map((a) => (
                  <div key={a.id} className="rounded-lg border border-border bg-background/40 p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground text-sm leading-tight line-clamp-2">{a.title}</p>
                      <Share2 className="h-3.5 w-3.5 text-tertiary flex-shrink-0 mt-0.5" />
                    </div>
                    <p className="text-xs text-tertiary truncate">{a.issuer_org || '—'}</p>
                    {a.credential?.bw_id && (
                      <Link to={`/verify/${a.credential.bw_id}`} className="text-[11px] font-mono text-primary hover:underline mt-1">
                        {a.credential.bw_id}
                      </Link>
                    )}
                    <div className="pt-1 border-t border-border/50">
                      <BlockwardVerifiedMark size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StudentDashboard() {
  return (
    <ProtectedRoute>
      <HolderOverviewContent />
    </ProtectedRoute>
  );
}