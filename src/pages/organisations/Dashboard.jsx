import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import OrgVerificationQueue from '@/components/organisations/OrgVerificationQueue';
import OrgSignatureCard from '@/components/organisations/OrgSignatureCard';
import OrgMembersPanel from '@/components/organisations/OrgMembersPanel';
import OrgPoliciesPanel from '@/components/organisations/OrgPoliciesPanel';
import OrgCredentialsCard from '@/components/organisations/OrgCredentialsCard';
import {
  ShieldCheck, ShieldAlert, ClipboardCheck, PenTool, Users,
  Award, Building2, Globe, ExternalLink,
} from 'lucide-react';

const ORG_TYPE_LABELS = {
  company: 'Company', university: 'University', school: 'School',
  certification_provider: 'Certification provider', training_provider: 'Training provider',
  competition: 'Competition', sports_organisation: 'Sports organisation',
  nonprofit: 'Non-profit', professional_organisation: 'Professional organisation', other: 'Organisation',
};

/**
 * OrgDashboard — the Issuer Organisation dashboard: Blockward verification
 * status, the live verification queue with review & signing, verifiers,
 * verification policies (owner), the member's signature setup and the
 * credentials this organisation has issued.
 */
export default function OrgDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');

  const load = useCallback(async (orgId = '') => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('orgDashboardData', { org_id: orgId || undefined });
      if (!res?.data?.ok) throw new Error(res?.data?.error || 'Could not load organisation data');
      setData(res.data);
      setSelectedOrgId(res.data.org?.id || '');
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not load organisation data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = () => load(selectedOrgId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => load(selectedOrgId)}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  // No organisation membership yet.
  if (!data?.org) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-lg font-bold text-foreground">
            {data?.memberships?.length
              ? 'Pick an organisation'
              : "You're not part of an organisation yet"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            {data?.memberships?.length
              ? 'You belong to more than one organisation — choose one to manage.'
              : 'Register your organisation to verify achievements and issue Blockward-verified credentials.'}
          </p>
          {data?.memberships?.length ? (
            <div className="flex flex-wrap justify-center gap-2">
              {data.memberships.map((m) => (
                <Button key={m.org_id} variant="outline" onClick={() => load(m.org_id)}>
                  {m.org_name}
                  {m.status === 'invited' && <Badge variant="secondary" className="ml-2">invited</Badge>}
                </Button>
              ))}
            </div>
          ) : (
            <Button asChild>
              <Link to="/organisations/signup">Register your organisation</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const { org, me, is_owner: isOwner, my_signature: mySignature, stats } = data;
  const verified = org.status === 'verified';
  const queueCount = data.queue?.length || 0;

  const statCards = [
    { icon: ClipboardCheck, label: 'Awaiting first review', value: stats?.pending_requests ?? 0 },
    { icon: PenTool, label: 'Awaiting signatures', value: stats?.awaiting_signatures ?? 0 },
    { icon: ShieldCheck, label: 'Verified this month', value: stats?.verified_this_month ?? 0 },
    { icon: Award, label: 'Total credentials', value: stats?.total_credentials ?? 0 },
    { icon: Users, label: 'Active verifiers', value: stats?.active_verifiers ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Multiple memberships — quick switcher */}
      {data.memberships?.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {data.memberships.map((m) => (
            <Button
              key={m.org_id}
              size="sm"
              variant={m.org_id === selectedOrgId ? 'default' : 'outline'}
              onClick={() => load(m.org_id)}
            >
              {m.org_name}
            </Button>
          ))}
        </div>
      )}

      {/* Organisation header */}
      <Card className="overflow-hidden">
        <div className="hero-glow relative p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-14 w-14 rounded-2xl object-cover border border-border" />
          ) : (
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-7 w-7 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{org.name}</h1>
              {verified ? (
                <Badge className="gap-1 bg-success/15 text-success border border-success/30">
                  <ShieldCheck className="h-3.5 w-3.5" /> Blockward Verified
                </Badge>
              ) : org.status === 'pending' ? (
                <Badge variant="warning" className="gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" /> Awaiting Blockward verification
                </Badge>
              ) : (
                <Badge variant="secondary" className="capitalize">{org.status}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {ORG_TYPE_LABELS[org.org_type] || 'Organisation'}
              {org.country ? ` · ${org.country}` : ''}
              {me?.job_title ? ` · ${me.job_title}` : ''}
              <span className="mx-1.5 text-border">|</span>
              <span className="capitalize">{me?.role || 'member'}</span>
            </p>
          </div>
          {org.handle && (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/org/${org.handle}`} target="_blank">
                <Globe className="h-4 w-4" /> Public issuer page <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </Card>

      {/* Verification authority banner */}
      {!verified && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Issuing is paused until Blockward verifies {org.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You can review and sign verifications now — credentials anchor to Polygon once the organisation is
              Blockward Verified.
            </p>
          </div>
        </div>
      )}

      {/* Signature status */}
      <OrgSignatureCard org={org} me={me} signature={mySignature} onSaved={refresh} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <s.icon className="h-4 w-4 text-primary mb-2" />
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Verification queue */}
      <OrgVerificationQueue
        org={org}
        queue={data.queue || []}
        mySignature={mySignature}
        onChanged={refresh}
      />

      {/* Recently completed + rejected */}
      {(data.recent_completed?.length > 0 || data.recent_rejected?.length > 0) && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Recently completed</h3>
            {data.recent_completed.map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-sm">
                <ShieldCheck className="h-4 w-4 text-success flex-shrink-0" />
                <span className="truncate flex-1">{r.achievement_title}</span>
                <span className="text-xs text-muted-foreground">
                  {r.signature_count}/{r.required_signatures} signed
                </span>
              </div>
            ))}
            {data.recent_rejected.map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-sm">
                <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0" />
                <span className="truncate flex-1">{r.achievement_title}</span>
                <span className="text-xs text-muted-foreground">could not verify</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Members + Policies (owner) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <OrgMembersPanel org={org} isOwner={isOwner} members={data.members || []} onChanged={refresh} />
        <div className="space-y-6">
          <OrgPoliciesPanel org={org} isOwner={isOwner} policies={data.policies || []} onChanged={refresh} />
        </div>
      </div>

      {/* Issued credentials */}
      <OrgCredentialsCard credentials={data.credentials || []} />

      {queueCount > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {queueCount} open verification{queueCount === 1 ? '' : 's'} waiting in the queue
        </p>
      )}
    </div>
  );
}