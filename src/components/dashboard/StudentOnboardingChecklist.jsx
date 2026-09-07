import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { Building2, Trophy, AtSign, Quote, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSchool } from '@/lib/SchoolContext';

/**
 * StudentOnboardingChecklist — shown when a student has no organisations and
 * no achievements. Each item ticks off as it's completed; the whole block
 * disappears once everything is done (and the normal dashboard returns as
 * soon as the student has any data).
 */
export default function StudentOnboardingChecklist({ profile, userEmail }) {
  const { testMode } = useSchool();
  const [state, setState] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let email = userEmail;
      try {
        if (!email) email = (await base44.auth.me())?.email;
        if (testMode?.isTestSuperUser && testMode.effectiveEmail) email = testMode.effectiveEmail;

        const [memberships, requests, self, endorsements] = await Promise.all([
          base44.entities.StudentOrgMembership.filter({ student_email: email }).catch(() => []),
          base44.entities.AchievementRequest.filter({ student_email: email }).catch(() => []),
          base44.entities.SelfReportedAchievement.filter({ student_email: email }).catch(() => []),
          base44.entities.Endorsement.filter({ endorser_email: email }).catch(() => []),
        ]);

        if (!cancelled) {
          setState({
            org: !!profile?.school_id || memberships.length > 0,
            achievement: requests.length > 0 || self.length > 0,
            handle: !!profile?.handle,
            endorse: endorsements.length > 0,
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            org: !!profile?.school_id,
            achievement: false,
            handle: !!profile?.handle,
            endorse: false,
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.school_id, profile?.handle, userEmail]);

  if (!state) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const items = [
    { label: 'Add your school or club', desc: 'Join with an invite or a school code', done: state.org, icon: Building2, to: 'JoinSchool' },
    { label: 'Add your first achievement', desc: 'Ask your organisation to verify something', done: state.achievement, icon: Trophy, to: 'StudentBlockWards' },
    { label: 'Claim your profile handle', desc: 'Get your shareable public profile', done: state.handle, icon: AtSign, to: 'Profile' },
    { label: 'Endorse someone', desc: 'Spend one of your peer endorsements', done: state.endorse, icon: Quote, to: 'Feed' },
  ];
  const doneCount = items.filter(i => i.done).length;

  return (
    <Card className="shadow-sm border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Set up your BlockWard profile</span>
          <span className="text-sm font-medium text-muted-foreground">{doneCount} of 4 done</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          A few quick steps and your achievements will start building up.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map(item => (
          <Link
            key={item.label}
            to={createPageUrl(item.to)}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl border transition-colors",
              item.done
                ? "border-success/30 bg-success/5"
                : "border-border bg-card/60 hover:bg-muted/50"
            )}
          >
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
              item.done ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
            )}>
              <item.icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium", item.done ? "text-muted-foreground line-through" : "text-foreground")}>
                {item.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
            {item.done
              ? <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
              : <Circle className="h-5 w-5 text-muted-foreground/40 flex-shrink-0" />}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}