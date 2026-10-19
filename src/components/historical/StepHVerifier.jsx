import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

/** Step 4 — Proposed verifier. The student nominates who can confirm the
 *  achievement but CANNOT grant verification authority: a Blockward Super
 *  Admin independently checks that this person is genuinely authorised. */
export default function StepHVerifier({ draft, setDraft }) {
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const inputCls = 'bg-secondary/60 border-border text-foreground placeholder:text-tertiary';
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Verifier's full name *</Label>
          <Input className={inputCls} value={draft.verifier_name} onChange={set('verifier_name')} maxLength={140}
            placeholder="e.g. Omar Haddad" />
        </div>
        <div className="space-y-1.5">
          <Label>Verifier's email address *</Label>
          <Input className={inputCls} type="email" value={draft.verifier_email} onChange={set('verifier_email')} maxLength={200}
            placeholder="their official work email" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Professional role *</Label>
          <Input className={inputCls} value={draft.verifier_role} onChange={set('verifier_role')} maxLength={120}
            placeholder="e.g. Tournament Director" />
        </div>
        <div className="space-y-1.5">
          <Label>Organisation *</Label>
          <Input className={inputCls} value={draft.verifier_org} onChange={set('verifier_org')} maxLength={140}
            placeholder="e.g. Dubai Youth Football League" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Verifier's LinkedIn profile URL (optional)</Label>
        <Input className={inputCls} value={draft.verifier_linkedin} onChange={set('verifier_linkedin')} maxLength={300}
          placeholder="https://www.linkedin.com/in/their-name" />
        {draft.verifier_linkedin && !/^https:\/\/(www\.)?linkedin\.com\/(in|company)\/[A-Za-z0-9_%\-.]+\/?$/i.test(draft.verifier_linkedin.trim()) && (
          <p className="text-xs text-destructive">Use the format https://www.linkedin.com/in/their-name</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Relationship to you *</Label>
        <Input className={inputCls} value={draft.verifier_relationship} onChange={set('verifier_relationship')} maxLength={120}
          placeholder="e.g. Tournament director at the event" />
      </div>
      <div className="space-y-1.5">
        <Label>Why this person is authorised to verify the achievement *</Label>
        <textarea
          rows={3} value={draft.verifier_authority_claim} onChange={set('verifier_authority_claim')} maxLength={1000}
          placeholder="e.g. They ran the championship and signed the award certificate — their name and role are on the certificate and on the league's official website."
          className="w-full rounded-lg bg-secondary/60 border border-border px-3 py-2 text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
        />
        <p className="text-xs text-tertiary">Legitimate verifiers: school administrators, teacher authorised by the school, competition organisers, sports association officials, programme directors, certification providers, authorised organisation representatives.</p>
      </div>
      <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-success" /> What happens next</p>
        <p className="text-xs text-muted-foreground">
          A Blockward Super Admin independently checks that this person is genuinely authorised — via the
          organisation's website, official records or confirmed contacts — before they receive a single-use
          verification link. Nominating someone never grants them verification authority.
        </p>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-warning mt-0.5 flex-shrink-0" />
          A family member, friend or anyone not authorised by the original organisation cannot approve your achievement — and a professional-looking email address is not enough on its own.
        </p>
      </div>
    </div>
  );
}