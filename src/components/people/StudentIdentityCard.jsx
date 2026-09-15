import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ShieldCheck, UserCheck, Info, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import { toast } from 'sonner';

// Tier pill — fixed colours matching the public badge.
function TierPill({ tier }) {
  if (tier === 'identity') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ color: '#B45309', border: '1px solid #B4530955', background: '#B4530914' }}>
        <ShieldCheck className="h-3 w-3" /> Identity confirmed
      </span>
    );
  }
  if (tier === 'member') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ color: '#1D4ED8', border: '1px solid #1D4ED855', background: '#1D4ED814' }}>
        <UserCheck className="h-3 w-3" /> Confirmed member
      </span>
    );
  }
  if (tier === null || tier === undefined) {
    return <span className="text-[11px] text-tertiary">—</span>;
  }
  return <span className="text-[11px] text-tertiary">No badge</span>;
}

/**
 * StudentIdentityCard — the admin's People view for the tier-3
 * "Identity confirmed" badge. One action per student: an admin of a
 * BlockWard-verified organisation explicitly confirms the profile belongs
 * to a real enrolled student. Authorisation, the audit log and the
 * student notification all happen server-side in setProfileBadge.
 */
export default function StudentIdentityCard({ school, profile }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState({});
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const orgVerified = school?.verification_status === 'verified';

  const load = useCallback(async () => {
    if (!profile?.school_id) { setLoading(false); return; }
    try {
      const [students, memberships] = await Promise.all([
        base44.entities.UserProfile.filter({ school_id: profile.school_id, user_type: 'student' }),
        base44.entities.StudentOrgMembership.filter({ school_id: profile.school_id, status: 'active' }),
      ]);
      const list = students.map((s) => ({
        key: s.id,
        id: s.id,
        email: s.user_email,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.user_email,
        tier: s.badge_tier || 'none',
        enrolled: true,
      }));
      const known = new Set(students.map((s) => s.user_email));
      for (const m of memberships) {
        if (known.has(m.student_email)) continue;
        list.push({
          key: m.id,
          id: null,
          email: m.student_email,
          name: m.student_name || m.student_email,
          tier: null,
          enrolled: false,
        });
      }
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setRows(list);
    } catch (e) {
      toast.error('Could not load the student list');
    } finally {
      setLoading(false);
    }
  }, [profile?.school_id]);

  useEffect(() => { load(); }, [load]);

  const filtered = query.trim()
    ? rows.filter((r) =>
        (r.name || '').toLowerCase().includes(query.trim().toLowerCase()) ||
        (r.email || '').toLowerCase().includes(query.trim().toLowerCase()))
    : rows;

  const confirm = async (row) => {
    setBusy((b) => ({ ...b, [row.key]: true }));
    try {
      const res = await base44.functions.invoke('setProfileBadge', {
        action: 'confirm_identity',
        ...(row.id ? { profile_id: row.id } : { student_email: row.email }),
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed');
      toast.success(res.data.changed === false ? 'Already confirmed' : 'Identity confirmed — the student has been notified');
      setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, tier: 'identity', id: r.id } : r)));
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Failed to confirm identity');
    } finally {
      setBusy((b) => ({ ...b, [row.key]: false }));
    }
  };

  const revoke = async () => {
    if (!revokeTarget) return;
    if (!reason.trim()) { toast.error('A reason is required'); return; }
    setRevoking(true);
    try {
      const res = await base44.functions.invoke('setProfileBadge', {
        action: 'revoke_identity',
        ...(revokeTarget.id ? { profile_id: revokeTarget.id } : { student_email: revokeTarget.email }),
        reason: reason.trim(),
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed');
      toast.success('Identity badge revoked — the student has been notified');
      setRows((prev) => prev.map((r) => (r.key === revokeTarget.key ? { ...r, tier: res.data.tier || 'none' } : r)));
      setRevokeTarget(null);
      setReason('');
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Failed to revoke');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#B45309]" /> Identity confirmation
        </CardTitle>
        <CardDescription>
          Confirm a profile belongs to a real enrolled student on your roster. The gold badge is earned by
          your confirmation alone — it can never be requested or bought by the student.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!orgVerified && (
          <div className="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/5 p-3">
            <ShieldAlert className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Your organisation isn't BlockWard-verified yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Identity confirmation — and the automatic blue "Confirmed member" badge — require an
                organisation verified by BlockWard.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students…"
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <p className="text-sm">No students found. Students appear here once they join your organisation.</p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border max-h-[28rem] overflow-y-auto">
            {filtered.map((row) => (
              <div key={row.key} className="flex flex-wrap items-center gap-3 p-3">
                <InitialsAvatar name={row.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {row.email}{!row.enrolled && ' · member via organisation request'}
                  </p>
                </div>
                <TierPill tier={row.tier} />
                <div className="flex items-center gap-2">
                  {row.tier !== 'identity' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => confirm(row)}
                      disabled={!orgVerified || busy[row.key]}
                    >
                      {busy[row.key] ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
                      Confirm identity
                    </Button>
                  )}
                  {row.tier === 'identity' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setRevokeTarget(row)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <p>
            Every confirmation and revocation is logged (who, when, why) and the student is notified. The blue
            "Confirmed member" badge is granted automatically to members of verified organisations — no action
            needed for that tier.
          </p>
        </div>
      </CardContent>

      <Dialog open={!!revokeTarget} onOpenChange={(o) => { if (!o) { setRevokeTarget(null); setReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke identity confirmation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This removes {revokeTarget?.name}'s gold "Identity confirmed" badge. The student keeps the blue
              member badge if they still qualify. The revocation is logged and the student is notified.
            </p>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required, shown to the student)"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRevokeTarget(null); setReason(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={revoke} disabled={revoking || !reason.trim()}>
              {revoking ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Revoke badge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}