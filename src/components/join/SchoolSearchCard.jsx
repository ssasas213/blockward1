import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Send, Check, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { InviteOrgForm } from '@/components/join/InviteOrganisationCard';

/**
 * SchoolSearchCard — the no-code fallback's "find your school" path. The user
 * searches every organisation on BlockWard and requests to join; an admin of
 * that school approves the request.
 */
export default function SchoolSearchCard() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [requestingId, setRequestingId] = useState(null);
  const [requested, setRequested] = useState({});

  const search = async () => {
    setSearching(true);
    try {
      const res = await base44.functions.invoke('orgMembershipAction', {
        action: 'search', query: query.trim(),
      });
      const data = res.data;
      if (!data?.ok) throw new Error(data?.error || 'Search failed');
      setResults(data.orgs || []);
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const request = async (org) => {
    setRequestingId(org.id);
    try {
      const res = await base44.functions.invoke('orgMembershipAction', {
        action: 'request', organisation_id: org.id,
      });
      const data = res.data;
      if (!data?.ok) throw new Error(data?.error || 'Failed to send request');
      setRequested((prev) => ({ ...prev, [org.id]: true }));
      toast.success(`Request sent to ${org.name}. An admin will review it.`);
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Failed to send request');
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <Card className="border-border bg-card/60 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">Search for your organisation</CardTitle>
        <CardDescription>Find your school, club, academy or team and request to join — an admin will approve you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Search by organisation name or city…"
            disabled={searching}
          />
          <Button onClick={search} disabled={searching} className="flex-shrink-0">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </div>

        {results !== null && (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {results.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  No organisations found{query ? ` for “${query}”` : ''}. Is yours not on BlockWard yet?
                </p>
                <InviteOrgForm compact />
              </div>
            )}
            {results.map((org) => {
              const isRequested = requested[org.id];
              const status = org.my_status;
              return (
                <div key={org.id} className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                  status === 'active' ? 'border-success/30 bg-success/5' : 'border-border bg-muted/20'
                )}>
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {org.logo_url ? (
                      <img src={org.logo_url} alt="" className="h-9 w-9 object-cover" />
                    ) : (
                      <Building2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{org.name}</p>
                    {(org.city || org.country) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[org.city, org.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  {status === 'active' ? (
                    <Badge variant="success" className="flex-shrink-0">Joined</Badge>
                  ) : status === 'pending' || isRequested ? (
                    <Badge variant="warning" className="flex-shrink-0">Pending</Badge>
                  ) : (
                    <Button
                      size="sm" variant="outline"
                      onClick={() => request(org)}
                      disabled={requestingId === org.id}
                      className="flex-shrink-0 h-8"
                    >
                      {requestingId === org.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                      Request
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}