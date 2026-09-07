import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2, Search, Plus, Check, Clock, Mail } from 'lucide-react';

/**
 * AddOrganisationDialog — join another organisation on BlockWard.
 * Search: browse every organisation on the platform and request membership.
 * Invite: bring a new organisation onboard by naming it and its admin email.
 */
export default function AddOrganisationDialog({ open, onOpenChange, onDone }) {
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [invite, setInvite] = useState({ name: '', email: '' });
  const [inviting, setInviting] = useState(false);

  const doSearch = async (q) => {
    setSearching(true);
    try {
      const res = await base44.functions.invoke('orgMembershipAction', { action: 'search', query: q });
      if (res.data?.ok) setResults(res.data.orgs || []);
      setSearched(true);
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (open && !searched) doSearch('');
  }, [open]);

  const requestJoin = async (org) => {
    setBusyId(org.id);
    try {
      const res = await base44.functions.invoke('orgMembershipAction', { action: 'request', organisation_id: org.id });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Request failed');
      toast.success(`Membership requested from ${org.name} — they'll approve it on their side`);
      setResults((rs) => rs.map((o) => (o.id === org.id ? { ...o, my_status: 'pending' } : o)));
      onDone?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setBusyId(null);
    }
  };

  const sendInvite = async () => {
    if (!invite.name.trim() || !invite.email.trim()) {
      toast.error('Enter the organisation name and an admin email');
      return;
    }
    setInviting(true);
    try {
      const res = await base44.functions.invoke('orgMembershipAction', {
        action: 'invite',
        organisation_name: invite.name,
        admin_email: invite.email,
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Invite failed');
      const status = res.data.email_status;
      toast.success(
        status === 'sent'
          ? `${invite.name} invited — their admin has been emailed a link to set it up`
          : `Created ${invite.name}. The admin invitation is queued — we'll email ${invite.email} to finish setup`
      );
      onDone?.();
      onOpenChange(false);
      setInvite({ name: '', email: '' });
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add another organisation</DialogTitle>
          <DialogDescription>
            Your profile can hold achievements from every organisation you belong to — school, club, academy or team.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setTab('search')}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${tab === 'search' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Search className="h-4 w-4 inline mr-1.5" /> Search organisations
          </button>
          <button
            onClick={() => setTab('invite')}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${tab === 'invite' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Mail className="h-4 w-4 inline mr-1.5" /> Invite one
          </button>
        </div>

        {tab === 'search' ? (
          <>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch(query)}
                placeholder="Search by name, city or country…"
              />
              <Button variant="outline" onClick={() => doSearch(query)} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
              {results.map((o) => (
                <div key={o.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3">
                  <InitialsAvatar name={o.name} src={o.logo_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{o.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(o.org_type || 'organisation').replace(/_/g, ' ')}
                      {(o.city || o.country) && ` · ${[o.city, o.country].filter(Boolean).join(', ')}`}
                    </p>
                  </div>
                  {o.my_status === 'active' ? (
                    <Badge variant="success" className="gap-1"><Check className="h-3 w-3" /> Joined</Badge>
                  ) : o.my_status === 'pending' ? (
                    <Badge variant="warning" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => requestJoin(o)} disabled={busyId === o.id}>
                      {busyId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Request
                    </Button>
                  )}
                </div>
              ))}
              {!searching && searched && results.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No organisations match "{query}". Try the Invite tab to bring them onto BlockWard.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Organisation name</Label>
              <Input
                value={invite.name}
                onChange={(e) => setInvite((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Gracie Barra Dubai, Dubai Chess Club, Dubai Music Academy"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Organisation admin email</Label>
              <Input
                type="email"
                value={invite.email}
                onChange={(e) => setInvite((f) => ({ ...f, email: e.target.value }))}
                placeholder="The person who runs it — we'll email them to set it up"
              />
              <p className="text-xs text-muted-foreground">
                They'll receive an invitation to set up {invite.name || 'the organisation'} on BlockWard with you as a
                member. Your membership activates once they approve it.
              </p>
            </div>
            <Button className="w-full" onClick={sendInvite} disabled={inviting}>
              {inviting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Send invitation
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}