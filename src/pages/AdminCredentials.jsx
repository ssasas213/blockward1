import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import EmptyState from '@/components/ui/empty-state';
import {
  Loader2, ShieldAlert, ShieldCheck, RefreshCw, Ban, ExternalLink, Link2,
} from 'lucide-react';
import { toast } from 'sonner';

const ANCHOR_BADGE = {
  minted: { label: 'Anchored', variant: 'success' },
  pending: { label: 'Anchor pending', variant: 'warning' },
  anchoring: { label: 'Anchoring…', variant: 'info' },
  failed: { label: 'Anchor failed', variant: 'destructive' },
};

/**
 * AdminCredentials — the organisation's credential register: every delivered
 * credential with its anchor status, revocation controls and on-chain retry.
 * Rendered as a tab inside ManageSchool; all authorisation happens in the
 * adminCredentialsData / adminCredentialAction backend functions.
 */
export default function AdminCredentials() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ credentials: [], summary: null });
  const [filter, setFilter] = useState('all');
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [supersededBy, setSupersededBy] = useState('');
  const [working, setWorking] = useState(false);
  const [retryingId, setRetryingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('adminCredentialsData', {});
      const d = res.data || {};
      if (!d.ok) throw new Error(d.error || 'Failed to load');
      setData({ credentials: d.credentials || [], summary: d.summary || null });
    } catch (e) {
      toast.error(e.message || 'Failed to load the credential register');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doRevoke = async () => {
    if (!reason.trim()) { toast.error('A reason is required'); return; }
    setWorking(true);
    try {
      const res = await base44.functions.invoke('adminCredentialAction', {
        action: 'revoke',
        verification_id: revokeTarget.verification_id,
        reason: reason.trim(),
        superseded_by_verification_id: supersededBy.trim() || null,
      });
      const d = res.data || {};
      if (!d.ok) throw new Error(d.error || 'Failed to revoke');
      toast.success('Credential revoked — the public verification page now shows it as revoked');
      setRevokeTarget(null); setReason(''); setSupersededBy('');
      load();
    } catch (e) {
      toast.error(e.message || 'Failed to revoke');
    } finally { setWorking(false); }
  };

  const retryAnchor = async (cred) => {
    setRetryingId(cred.verification_id);
    try {
      const res = await base44.functions.invoke('anchorRetry', { verification_id: cred.verification_id });
      const d = res.data || {};
      if (d.ok) toast.success(d.already_anchored ? 'Already anchored on-chain' : 'Anchoring re-triggered');
      else toast.error(d.error || 'Retry failed');
      load();
    } catch (e) {
      toast.error(e.message || 'Retry failed');
    } finally { setRetryingId(null); }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  const s = data.summary || { total: 0, revoked: 0, anchors: {} };
  const filtered = data.credentials.filter(c => {
    if (filter === 'revoked') return c.approval_status === 'revoked';
    if (filter === 'anchor_issues') return c.nft_status === 'failed' || c.nft_status === 'pending' || c.chain_status === 'hash_mismatch';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Anchor monitor summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="surface-card"><CardContent className="p-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-success" />
          <div><p className="text-xs text-muted-foreground">Anchored on-chain</p><p className="text-xl font-bold">{s.anchors?.minted || 0}</p></div>
        </CardContent></Card>
        <Card className="surface-card"><CardContent className="p-4 flex items-center gap-3">
          <Link2 className="h-5 w-5 text-warning" />
          <div><p className="text-xs text-muted-foreground">Pending anchor</p><p className="text-xl font-bold">{s.anchors?.pending || 0}</p></div>
        </CardContent></Card>
        <Card className="surface-card"><CardContent className="p-4 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          <div><p className="text-xs text-muted-foreground">Failed anchor</p><p className="text-xl font-bold">{s.anchors?.failed || 0}</p></div>
        </CardContent></Card>
        <Card className="surface-card"><CardContent className="p-4 flex items-center gap-3">
          <Ban className="h-5 w-5 text-muted-foreground" />
          <div><p className="text-xs text-muted-foreground">Revoked</p><p className="text-xl font-bold">{s.revoked || 0}</p></div>
        </CardContent></Card>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All ({s.total})</TabsTrigger>
          <TabsTrigger value="anchor_issues">Anchor issues</TabsTrigger>
          <TabsTrigger value="revoked">Revoked</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          {filtered.length === 0 ? (
            <EmptyState title="No credentials in this view" description="Credentials appear here once verified and delivered to a student vault." />
          ) : (
            <div className="space-y-2">
              {filtered.map(c => {
                const anchor = ANCHOR_BADGE[c.nft_status] || ANCHOR_BADGE.pending;
                const isRevoked = c.approval_status === 'revoked';
                return (
                  <Card key={c.id} className={`surface-card ${isRevoked ? 'opacity-70' : ''}`}>
                    <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground truncate">{c.achievement_title}</p>
                          <Badge variant={isRevoked ? 'destructive' : 'success'}>{isRevoked ? 'Revoked' : 'Verified'}</Badge>
                          <Badge variant={anchor.variant}>{anchor.label}{c.chain_status === 'hash_mismatch' ? ' · hash mismatch' : ''}</Badge>
                          {c.version > 1 && <Badge variant="outline">v{c.version}</Badge>}
                          {c.verification_mode === 'independent' && <Badge variant="outline">Independent</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {c.student_name} · {c.teacher_name || '—'} · {c.date_achieved || 'no date'} · <span className="font-mono text-xs">{c.verification_id}</span>
                        </p>
                        {isRevoked && c.revocation && (
                          <p className="text-xs text-destructive mt-1">
                            Revoked {new Date(c.revocation.revoked_at).toLocaleDateString()} by {c.revocation.revoked_by_name}
                            {c.revocation.superseded_by_verification_id ? ` — superseded by ${c.revocation.superseded_by_verification_id}` : ''}: {c.revocation.reason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/verify/${c.verification_id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        {!isRevoked && (c.nft_status === 'pending' || c.nft_status === 'failed') && (
                          <Button variant="outline" size="sm" disabled={retryingId === c.verification_id} onClick={() => retryAnchor(c)}>
                            {retryingId === c.verification_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            <span className="ml-1">Retry anchor</span>
                          </Button>
                        )}
                        {!isRevoked && (
                          <Button variant="destructive" size="sm" onClick={() => setRevokeTarget(c)}>
                            <Ban className="h-4 w-4" />
                            <span className="ml-1">Revoke</span>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Revoke dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={(o) => { if (!o) { setRevokeTarget(null); setReason(''); setSupersededBy(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke credential</DialogTitle>
            <DialogDescription>
              {revokeTarget && <>“{revokeTarget.achievement_title}” — {revokeTarget.student_name} ({revokeTarget.verification_id})</>}
              <br />Revocation is permanent, audited, and the public verification page will immediately show this credential as revoked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason (required)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Issued in error — the achievement was not completed" />
            </div>
            <div className="space-y-2">
              <Label>Superseded by (optional)</Label>
              <Input value={supersededBy} onChange={(e) => setSupersededBy(e.target.value)} placeholder="Verification ID of the replacement credential, if any" className="font-mono" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRevokeTarget(null); setReason(''); setSupersededBy(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={doRevoke} disabled={working || !reason.trim()}>
              {working ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Revoke credential
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}