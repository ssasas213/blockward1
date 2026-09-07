import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import AddOrganisationDialog from '@/components/profile/AddOrganisationDialog';
import { domainOf, domainLabel, DOMAIN_ORDER } from '@/lib/achievementDomains';
import { Globe2, Plus, ExternalLink, Clock } from 'lucide-react';

/**
 * CrossOrgAchievementsCard — aggregates the student's verified credentials
 * across EVERY organisation they belong to, with per-organisation and
 * per-category counts, plus the "Add another organisation" entry point.
 */
export default function CrossOrgAchievementsCard({ profile, userEmail }) {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [domains, setDomains] = useState([]);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!profile?.id || !userEmail) return;
    let active = true;
    (async () => {
      try {
        const [records, memberships] = await Promise.all([
          base44.entities.BlockWardVerificationRegistry.filter({ student_id: profile.id }),
          base44.entities.StudentOrgMembership.filter({ student_email: userEmail }),
        ]);
        if (!active) return;
        const verified = records.filter((r) => r.approval_status === 'approved');

        // Orgs: from verified records + memberships (incl. pending ones).
        const orgMap = {};
        for (const r of verified) {
          const key = r.school_id || `name:${r.organisation_name}`;
          if (!orgMap[key]) orgMap[key] = { id: r.school_id, name: r.organisation_name || 'Organisation', count: 0, status: 'active' };
          orgMap[key].count += 1;
        }
        for (const m of memberships) {
          const key = m.school_id;
          if (!orgMap[key]) orgMap[key] = { id: m.school_id, name: m.school_name, count: 0, status: m.status };
          else if (m.status === 'active') orgMap[key].status = 'active';
        }
        const orgList = Object.values(orgMap).sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));

        // Per-category counts.
        const counts = {};
        for (const r of verified) {
          const d = domainOf(r);
          counts[d] = (counts[d] || 0) + 1;
        }
        setOrgs(orgList);
        setDomains(DOMAIN_ORDER.filter((d) => counts[d]).map((d) => ({ domain: d, count: counts[d] })));
        setTotal(verified.length);
      } catch (e) {
        console.error('Error loading cross-org achievements:', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [profile?.id, userEmail, reload]);

  if (loading) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-primary" />
          Achievements across organisations
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add another organisation
        </Button>
      </CardHeader>
      <CardContent>
        {orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no organisations yet — add your school, club or academy to start collecting verified credentials.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {orgs.map((o) => (
              <span key={o.id || o.name} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1.5">
                <InitialsAvatar name={o.name} size="xs" />
                <span className="text-xs font-medium text-foreground">{o.name}</span>
                {o.count > 0 ? (
                  <Badge variant="default" className="px-1.5 text-[10px]">{o.count}</Badge>
                ) : o.status === 'pending' ? (
                  <Badge variant="warning" className="gap-1 px-1.5 text-[10px]"><Clock className="h-3 w-3" /> pending</Badge>
                ) : null}
              </span>
            ))}
          </div>
        )}

        {domains.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{total} verified</span>
            {domains.map((d) => (
              <span key={d.domain}>{domainLabel(d.domain)} · {d.count}</span>
            ))}
          </div>
        )}

        {profile?.handle && (
          <Button size="sm" variant="ghost" className="mt-3 px-0 text-primary" asChild>
            <Link to={`/@${profile.handle}`}>
              View my public profile <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        )}
      </CardContent>

      <AddOrganisationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={() => setReload(Date.now())}
      />
    </Card>
  );
}