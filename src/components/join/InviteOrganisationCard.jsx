import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * InviteOrgForm — bring an organisation that isn't on BlockWard yet: enter
 * its name and an admin email. The backend creates the organisation as an
 * inbound lead (created_by = the student), emails the admin an invitation,
 * and queues the student's pending membership for when they approve.
 */
export function InviteOrgForm({ onDone, compact = false }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Enter the organisation name and an admin email');
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('orgMembershipAction', {
        action: 'invite',
        organisation_name: name.trim(),
        admin_email: email.trim(),
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Invite failed');
      toast.success(`${name.trim()} invited — their admin has been emailed, and your membership activates when they approve it`);
      setSent(true);
      onDone?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Invite failed');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
        <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">{name.trim()}</span> has been invited. You can now request verification from them while they set things up.
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className={compact ? 'space-y-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
        <div className="space-y-1.5">
          <Label>Organisation name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Gracie Barra Dubai, Dubai Chess Club"
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Their admin email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="The person who runs it — we'll email them"
            disabled={busy}
          />
        </div>
      </div>
      <Button onClick={send} disabled={busy} className={compact ? 'w-full sm:w-auto' : 'w-full'}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
        Send invitation
      </Button>
    </div>
  );
}

/** Standalone card version — option 3 on the Add-your-school-or-club page. */
export default function InviteOrganisationCard({ onDone }) {
  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg text-foreground flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> Not on BlockWard yet?
        </CardTitle>
        <CardDescription>
          Invite any organisation — school, club, academy, dojo or team. We'll email their admin to set it up, and you join as soon as they approve you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InviteOrgForm onDone={onDone} />
      </CardContent>
    </Card>
  );
}