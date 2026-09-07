import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, CalendarClock, CheckCircle2, XCircle, Globe } from 'lucide-react';
import { OPPORTUNITY_TYPE_LABELS, daysUntil, formatDeadline } from '@/lib/opportunities';
import { CATEGORY_LABELS } from '@/lib/achievementRequests';

/**
 * OpportunityCard — one listing in the student feed, with the credential
 * match indicator ("You match X of Y") and the first missing requirement
 * linked to the request-verification flow.
 */
export default function OpportunityCard({ opportunity, onApply }) {
  const o = opportunity;
  const match = o.match || { matched_count: 0, total_required: 0, unmet_required: [] };
  const days = daysUntil(o.application_deadline);
  const pastDeadline = days !== null && days < 0;
  const applied = !!o.applied_application_id;
  const firstMissing = match.unmet_required?.[0];
  const closingSoon = days !== null && days >= 0 && days <= 7;

  return (
    <Card className="surface-card card-hover flex flex-col">
      <CardContent className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-tertiary truncate">{o.organisation_name}</p>
            <h3 className="font-semibold text-foreground leading-snug">{o.title}</h3>
          </div>
          <Badge variant="secondary" className="flex-shrink-0">
            {OPPORTUNITY_TYPE_LABELS[o.type] || o.type}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="outline">{CATEGORY_LABELS[o.category] || o.category}</Badge>
          {o.is_remote ? (
            <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Remote</span>
          ) : o.location ? (
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {o.location}</span>
          ) : null}
          <span className={`flex items-center gap-1 ${closingSoon ? 'text-warning' : ''}`}>
            <CalendarClock className="h-3.5 w-3.5" />
            {pastDeadline ? 'Closed' : `Deadline ${formatDeadline(o.application_deadline)}`}
          </span>
          {o.min_age ? <span>Min age {o.min_age}</span> : null}
        </div>

        <p className="text-sm text-muted-foreground line-clamp-3">{o.description}</p>

        {match.total_required > 0 && (
          <div className={`rounded-lg border p-3 ${match.full_match ? 'border-success/30 bg-success/5' : 'border-border bg-secondary/40'}`}>
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {match.full_match
                ? <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                : <XCircle className="h-4 w-4 text-warning flex-shrink-0" />}
              You match {match.matched_count} of {match.total_required} required credentials
            </p>
            {firstMissing && (
              <p className="text-xs text-muted-foreground mt-1">
                Still needed: <span className="font-medium text-foreground">{firstMissing.label}</span> —{' '}
                <Link to="/StudentBlockWards" className="text-primary underline-offset-2 hover:underline">
                  request verification
                </Link>
              </p>
            )}
          </div>
        )}

        <div className="mt-auto pt-1 flex items-center justify-between">
          <span className="text-xs text-tertiary">
            {applied ? 'Application sent' : 'Verified credentials attach automatically'}
          </span>
          {applied ? (
            <Badge variant="success">Applied</Badge>
          ) : (
            <Button size="sm" onClick={() => onApply(o)} disabled={o.status !== 'open' || pastDeadline}>
              Apply
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}