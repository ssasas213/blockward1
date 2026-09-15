import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BadgeCheck, ShieldCheck, Award } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ProfileBadge from '@/components/publicProfile/ProfileBadge';
import { format } from 'date-fns';

/**
 * BadgeSection — the student's own view of their EARNED verification badge.
 * Never a purchase, never a request form: it explains the current tier and
 * the only genuine path to the next one.
 */
export default function BadgeSection({ profile }) {
  const tier = profile?.badge_tier || 'none';
  const [orgName, setOrgName] = useState(null);

  // The badge org is usually the home school (readable via RLS); a cross-org
  // badge org may not be readable by the student, so the label falls back.
  useEffect(() => {
    let active = true;
    if (!profile?.badge_org_id) return undefined;
    base44.entities.School.filter({ id: profile.badge_org_id })
      .then((rows) => { if (active && rows[0]) setOrgName(rows[0].name); })
      .catch(() => {});
    return () => { active = false; };
  }, [profile?.badge_org_id]);

  const org = orgName || 'your verified organisation';

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-foreground">
          <Award className="h-4 w-4 text-primary" /> Verification badge
        </CardTitle>
        <CardDescription>A trust signal about you — earned, never purchased</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tier === 'identity' ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <ProfileBadge tier="identity" orgName={org} grantedAt={profile.badge_granted_at} />
              <span className="text-xs text-muted-foreground">
                {profile.badge_granted_at && `since ${format(new Date(profile.badge_granted_at), 'd MMM yyyy')}`}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              An administrator of <span className="font-medium text-foreground">{org}</span> confirmed that
              your profile belongs to a real enrolled student. This is the highest badge tier — it appears
              next to your name on your public profile, your share cards and every verification page.
            </p>
          </>
        ) : tier === 'member' ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <ProfileBadge tier="member" orgName={org} grantedAt={profile.badge_granted_at} />
              <span className="text-xs text-muted-foreground">
                {profile.badge_granted_at && `since ${format(new Date(profile.badge_granted_at), 'd MMM yyyy')}`}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You're an active member of <span className="font-medium text-foreground">{org}</span>, a
              BlockWard-verified organisation, so your public profile shows the blue badge. It's granted and
              removed automatically as your memberships change.
            </p>
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/50 p-3">
              <ShieldCheck className="h-4 w-4 text-[#B45309] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Earning the gold "Identity confirmed" badge:</span>{' '}
                an admin of a verified organisation you belong to can confirm you're a real enrolled student from
                their People page. There's nothing to buy and nothing to request here — it's their call.
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/50 p-3">
            <BadgeCheck className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              You don't hold a verification badge yet. Badges are{' '}
              <span className="font-medium text-foreground">earned — never purchased and never self-declared</span>.
              The blue "Confirmed member" badge appears automatically once you join an organisation that
              BlockWard has verified — join one from your school membership settings.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}