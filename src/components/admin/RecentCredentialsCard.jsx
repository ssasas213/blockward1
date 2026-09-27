import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import { Shield, ChevronRight, Ban } from 'lucide-react';

/**
 * RecentCredentialsCard — the latest credentials the organisation issued:
 * title, student, status and a direct public-verification link, with the
 * full register one click away (Manage School → Credentials). Data comes
 * from the same adminCredentialsData function that powers the register —
 * the same org boundary, the same authorisation.
 */
export default function RecentCredentialsCard({ limit = 3 }) {
  const [credentials, setCredentials] = useState(null);

  useEffect(() => {
    let alive = true;
    base44.functions.invoke('adminCredentialsData', {})
      .then((res) => {
        if (!alive) return;
        setCredentials(res.data?.ok ? (res.data.credentials || []) : []);
      })
      .catch(() => { if (alive) setCredentials([]); });
    return () => { alive = false; };
  }, []);

  const recent = (credentials || [])
    .slice()
    .sort((a, b) => new Date(b.date_delivered || b.created_date || b.date_achieved || 0)
      - new Date(a.date_delivered || a.created_date || a.date_achieved || 0))
    .slice(0, limit);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recently issued credentials</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to={createPageUrl('ManageSchool?tab=credentials')}>
            View register <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {credentials === null ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/60 animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No credentials issued yet"
            description="Credentials appear here once achievements are verified and delivered to students."
          />
        ) : (
          <ul className="space-y-1.5">
            {recent.map((c) => {
              const isRevoked = c.approval_status === 'revoked';
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary flex-shrink-0">
                    {isRevoked
                      ? <Ban className="h-4 w-4 text-destructive" aria-hidden="true" />
                      : <Shield className="h-4 w-4 text-primary" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{c.achievement_title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.student_name}
                      {c.date_delivered
                        ? ` · ${new Date(c.date_delivered).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                        : ''}
                    </p>
                  </div>
                  <Badge variant={isRevoked ? 'destructive' : 'success'} className="flex-shrink-0">
                    {isRevoked ? 'Revoked' : 'Verified'}
                  </Badge>
                  <Button variant="ghost" size="sm" asChild className="flex-shrink-0">
                    <a
                      href={`/verify/${c.verification_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open public verification page for ${c.achievement_title}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}