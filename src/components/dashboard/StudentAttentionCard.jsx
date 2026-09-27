import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, PenLine, Clock, ShieldCheck, ChevronRight } from 'lucide-react';

// Requests where the NEXT move is the STUDENT's. Everything else (waiting on
// a verifier, terminal states) stays on the Requests tab — this card only
// surfaces things that will otherwise sit unactioned.
const ACTIONABLE = [
  {
    match: (r) => r.status === 'changes_requested',
    Icon: PenLine,
    heading: () => 'Your verifier asked for changes',
    detail: (r) => r.changes_requested_reason || 'Read their comment, update the details and send it back.',
  },
  {
    match: (r) => r.status === 'draft',
    Icon: PenLine,
    heading: () => 'Draft waiting to be finished',
    detail: () => 'Add the remaining details and submit it for review.',
  },
  {
    match: (r) => r.status === 'approved' && !r.verification_id,
    Icon: ShieldCheck,
    heading: () => 'Ready to publish to your profile',
    detail: () => 'Your verifier signed off — finish publishing to add it to your Vault.',
  },
  {
    match: (r) => r.status === 'expired',
    Icon: Clock,
    heading: () => 'Expired without a review',
    detail: () => 'Nobody reviewed it within 30 days — you can submit it again.',
  },
];

/**
 * StudentAttentionCard — dashboard panel for achievement requests that need
 * the student to act. Renders nothing while loading and nothing when the
 * student is fully up to date, so it never adds noise.
 */
export default function StudentAttentionCard({ requests, loading = false }) {
  if (loading || !requests) return null;

  const items = [];
  for (const r of requests) {
    const rule = ACTIONABLE.find((a) => a.match(r));
    if (rule) items.push({ r, rule });
  }
  if (items.length === 0) return null;

  return (
    <Card className="border-warning/30 bg-warning/5" data-testid="student-attention">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
          <h2 className="text-base font-semibold text-foreground">Needs your attention</h2>
          <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
            {items.length}
          </span>
        </div>
        <ul className="space-y-2.5">
          {items.map(({ r, rule }) => (
            <li key={r.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <rule.Icon className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{rule.heading(r)}</p>
                <p className="text-sm font-medium text-foreground truncate mt-0.5">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rule.detail(r)}</p>
              </div>
            </li>
          ))}
        </ul>
        <Button asChild size="sm" className="mt-4 w-full sm:w-auto">
          <Link to={createPageUrl('StudentBlockWards?tab=pending')}>
            Open my requests <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}