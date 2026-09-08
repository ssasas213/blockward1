import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MailQuestion, Send } from 'lucide-react';
import { toast } from 'sonner';

// Holding card for under-13 accounts: the profile exists but stays inactive
// until the parent/guardian confirms the emailed consent link. The guardian
// email IS the parent contact field (parent_email) — editing it here keeps a
// single source of truth, same as the student dashboard's parent contact card.
export default function GuardianConsentCard({ onSignOut }) {
  const [profile, setProfile] = useState(null);
  const [guardianEmail, setGuardianEmail] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
        if (profiles.length > 0) {
          setProfile(profiles[0]);
          setGuardianEmail(profiles[0].parent_email || profiles[0].guardian_consent?.guardian_email || '');
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const handleResend = async () => {
    if (!guardianEmail.trim()) {
      toast.error("Enter your parent or guardian's email.");
      return;
    }
    setSending(true);
    try {
      const res = await base44.functions.invoke('guardianConsentAction', {
        action: 'resend',
        guardian_email: guardianEmail.trim(),
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not resend.');
      toast.success(`Consent link sent to ${res.data.guardian_email}.`);
    } catch (err) {
      toast.error(err?.message || 'Could not resend the consent email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="text-center">
      <div className="mx-auto h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center mb-4">
        <MailQuestion className="h-6 w-6 text-warning" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">Waiting for parent or guardian consent</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Because you're under 13, your account activates as soon as a parent or guardian confirms the link we emailed them.
      </p>
      <div className="space-y-2 text-left mb-6">
        <Label className="text-foreground">Parent or guardian's email</Label>
        <div className="flex gap-2">
          <Input
            type="email"
            value={guardianEmail}
            onChange={(e) => setGuardianEmail(e.target.value)}
            placeholder="parent@example.com"
            disabled={sending}
          />
          <Button onClick={handleResend} disabled={sending} variant="outline" className="flex-shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="hidden sm:inline">Resend link</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {profile?.guardian_consent?.status === 'granted'
            ? 'Consent has been recorded — sign out and back in to continue.'
            : 'Made a typo? Fix it here and resend — the previous link stops working.'}
        </p>
      </div>
      <Button onClick={onSignOut} variant="outline" className="w-full">Sign Out</Button>
    </div>
  );
}