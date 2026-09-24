import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Copy, Check, Loader2, Plus, Ban, QrCode } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

function CodeRow({ code, onAction }) {
  const [copied, setCopied] = useState(false);
  const active = code.status === 'active';
  const expired = active && code.expires_at && Date.now() > new Date(code.expires_at).getTime();
  const exhausted = active && code.max_uses != null && (code.use_count || 0) >= code.max_uses;
  const joinUrl = `${window.location.origin}/JoinClass?code=${code.code}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=16&data=${encodeURIComponent(joinUrl)}`;

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    toast.success('Invite link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <code className="font-mono font-semibold tracking-widest text-foreground">{code.code}</code>
        <div className="flex items-center gap-1.5 flex-wrap">
          {active && !expired && !exhausted ? (
            <Badge variant="success" className="text-[10px]">Active</Badge>
          ) : (
            <Badge variant="destructive" className="text-[10px]">
              {code.status === 'disabled' ? 'Revoked' : expired ? 'Expired' : exhausted ? 'Used up' : 'Inactive'}
            </Badge>
          )}
          {code.expires_at && (
            <Badge variant="outline" className="text-[10px]">
              Until {format(new Date(code.expires_at), 'd MMM, HH:mm')}
            </Badge>
          )}
          {code.max_uses != null && (
            <Badge variant="outline" className="text-[10px]">{code.use_count || 0}/{code.max_uses} used</Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button size="sm" variant="outline" onClick={copyLink}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy link
        </Button>
        <a href={qrSrc} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline"><QrCode className="h-3.5 w-3.5" /> QR</Button>
        </a>
        {active && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onAction('revoke', code)}>
            <Ban className="h-3.5 w-3.5" /> Revoke
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground break-all">{joinUrl}</p>
    </div>
  );
}

/**
 * ClassInviteDialog — expiring, revocable class codes, links and QR
 * invitations. Students join with the code, the link, or by scanning the
 * QR (all lead to /JoinClass?code=…).
 */
export default function ClassInviteDialog({ open, onOpenChange, cls }) {
  const [codes, setCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expiryHours, setExpiryHours] = useState('');
  const [maxUses, setMaxUses] = useState('');

  const load = async () => {
    if (!cls?.id) return;
    try {
      const res = await base44.functions.invoke('classCodeAction', { action: 'list', class_id: cls.id });
      if (res.data?.ok) setCodes(res.data.codes || []);
      else { toast.error(res.data?.error || 'Could not load invite codes'); setCodes([]); }
    } catch (e) {
      toast.error('Could not load invite codes');
      setCodes([]);
    }
  };

  useEffect(() => {
    if (open) { setCodes(null); load(); }
  }, [open, cls?.id]);

  const generate = async () => {
    setBusy(true);
    try {
      const hours = Number(expiryHours);
      const res = await base44.functions.invoke('classCodeAction', {
        action: 'generate',
        class_id: cls.id,
        expires_at: expiryHours && hours > 0 ? new Date(Date.now() + hours * 3600000).toISOString() : null,
        max_uses: maxUses ? Number(maxUses) : null,
      });
      if (res.data?.ok) { toast.success('Invite code created'); await load(); }
      else toast.error(res.data?.error || 'Could not create a code');
    } catch (e) {
      toast.error('Could not create a code');
    } finally {
      setBusy(false);
    }
  };

  const act = async (action, code) => {
    try {
      const res = await base44.functions.invoke('classCodeAction', { action, code_id: code.id });
      if (res.data?.ok) {
        toast.success(action === 'revoke' ? 'Code revoked — it no longer works' : 'Done');
        await load();
      } else {
        toast.error(res.data?.error || 'Action failed');
      }
    } catch (e) {
      toast.error('Action failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Class invites — {cls?.name}</DialogTitle>
          <DialogDescription>
            Create expiring invite codes. Students join with the code, the link, or by scanning the QR. Revoking a code stops it working immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border border-border p-3 space-y-3">
            <p className="text-sm font-medium text-foreground">New invite code</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-expiry">Expires in (hours)</Label>
                <Input
                  id="invite-expiry" type="number" min="1" placeholder="Never"
                  value={expiryHours} onChange={(e) => setExpiryHours(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-max">Max uses</Label>
                <Input
                  id="invite-max" type="number" min="1" placeholder="Unlimited"
                  value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
                />
              </div>
            </div>
            <Button size="sm" onClick={generate} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Create code
            </Button>
          </div>

          {codes === null ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : codes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No invite codes yet — create one above.</p>
          ) : (
            <div className="space-y-2">
              {codes.map((c) => <CodeRow key={c.id} code={c} onAction={act} />)}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}