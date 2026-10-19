import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Linkedin, Info } from 'lucide-react';

/** Step 3 — Your Professional Profile. LinkedIn gives the review team context
 *  about who the student is; it NEVER verifies an achievement. Optional. */
export default function StepHProfile({ draft, setDraft }) {
  const inputCls = 'bg-secondary/60 border-border text-foreground placeholder:text-tertiary';
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Full name *</Label>
        <Input className={inputCls} value={draft.profile_full_name} maxLength={140}
          onChange={(e) => setDraft((d) => ({ ...d, profile_full_name: e.target.value }))}
          placeholder="Your full name as it should appear on records" />
      </div>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5"><Linkedin className="h-3.5 w-3.5 text-primary" /> LinkedIn profile URL (optional)</Label>
        <Input className={inputCls} value={draft.linkedin_url} maxLength={300}
          onChange={(e) => setDraft((d) => ({ ...d, linkedin_url: e.target.value }))}
          placeholder="https://www.linkedin.com/in/your-name" />
        {draft.linkedin_url && !/^https:\/\/(www\.)?linkedin\.com\/(in|company)\/[A-Za-z0-9_%\-.]+\/?$/i.test(draft.linkedin_url.trim()) && (
          <p className="text-xs text-destructive">Use the format https://www.linkedin.com/in/your-name</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Personal website or portfolio (optional)</Label>
        <Input className={inputCls} value={draft.personal_website} maxLength={300}
          onChange={(e) => setDraft((d) => ({ ...d, personal_website: e.target.value }))}
          placeholder="https://your-portfolio.example.com" />
        {draft.personal_website && !/^https:\/\/\S+/.test(draft.personal_website.trim()) && (
          <p className="text-xs text-destructive">Websites must be https URLs</p>
        )}
      </div>
      <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info/5 p-3">
        <Info className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Your LinkedIn profile may help our review team understand your professional background.
          It does not independently verify your achievements — and it never appears on any credential
          or public page. No LinkedIn account? Skip this — the process works without it.
        </p>
      </div>
    </div>
  );
}