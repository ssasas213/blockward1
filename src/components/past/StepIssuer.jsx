import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, Loader2, CheckCircle2, Clock, Building2, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * StepIssuer — find who can verify this past achievement.
 * A: search BlockWard's registered organisations (verified ones can confirm).
 * B: no match → invite the organisation; Blockward emails their official
 *    contact an invitation to register, and the claim waits for them.
 */
export default function StepIssuer({ draft, setDraft }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState({ name: draft.issuer_org || '', website: '', contact_email: '' });
  const [invited, setInvited] = useState(false);

  const setOrg = (org) => setDraft((d) => ({ ...d, org, suggested: null }));
  const setSuggest = (s) => setDraft((d) => ({ ...d, suggested: s, org: null }));

  const doSearch = async () => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await base44.functions.invoke('searchIssuers', { q: q.trim() });
      setResults(res.data?.results || []);
    } catch {
      toast.error('Search failed — try again');
    } finally {
      setSearching(false);
    }
  };

  const doInvite = async () => {
    const { name, website, contact_email } = invite;
    if (!name.trim() || !contact_email.trim()) {
      toast.error('Add the organisation name and an official contact email');
      return;
    }
    setInviting(true);
    try {
      const res = await base44.functions.invoke('searchIssuers', {
        action: 'suggest', name: name.trim(), website: website.trim(), contact_email: contact_email.trim(),
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Invite failed');
      setSuggest({ name: name.trim(), contact_email: contact_email.trim() });
      setInvited(true);
      toast.success(`${name.trim()} has been invited to join Blockward`);
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Method A — search registered organisations */}
      <div className="space-y-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Find the issuing organisation</p>
            <p className="text-xs text-muted-foreground">
              Already on BlockWard? Your request goes straight to their issuer dashboard.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              placeholder="Search organisations…"
              className="pl-9"
            />
          </div>
          <Button type="button" variant="outline" onClick={doSearch} disabled={searching || !q.trim()}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {results !== null && results.length === 0 && (
          <p className="text-xs text-tertiary">No registered organisation matches — invite them below.</p>
        )}
        {(results || []).map((o) => {
          const selected = draft.org?.id === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setOrg(o)}
              className={cn(
                'w-full text-left rounded-xl border p-3.5 flex items-center gap-3 transition-all',
                selected ? 'border-primary/50 bg-primary/5' : 'border-border bg-card/40 hover:border-primary/30',
              )}
            >
              <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{o.name}</p>
                <p className="text-xs text-tertiary truncate">{o.website || o.email_domain || 'Registered on BlockWard'}</p>
              </div>
              {o.status === 'verified' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success flex-shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning flex-shrink-0">
                  <Clock className="h-3.5 w-3.5" /> Awaiting approval
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Method B — invite an unregistered organisation */}
      {!invited && (
        <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
          <div className="flex items-start gap-2.5">
            <UserPlus className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Can't find them? Invite your issuer</p>
              <p className="text-xs text-muted-foreground">
                We email the organisation an invitation to register. They review your claim once they join.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Organisation name</Label>
              <Input value={invite.name} onChange={(e) => setInvite((v) => ({ ...v, name: e.target.value }))} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label>Official website (optional)</Label>
              <Input
                value={invite.website}
                onChange={(e) => setInvite((v) => ({ ...v, website: e.target.value }))}
                placeholder="https://…"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Official contact email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
              <Input
                type="email"
                value={invite.contact_email}
                onChange={(e) => setInvite((v) => ({ ...v, contact_email: e.target.value }))}
                placeholder="An admin at the organisation"
                className="pl-9"
              />
            </div>
          </div>
          <Button type="button" variant="outline" onClick={doInvite} disabled={inviting} className="w-full sm:w-auto">
            {inviting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Send invitation
          </Button>
        </div>
      )}

      {invited && (
        <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
          <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">{draft.suggested?.name}</span> has been invited.
            Your achievement is saved privately and becomes verifiable once they join.
          </p>
        </div>
      )}
    </div>
  );
}