import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import PageHeader from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import GlowActionButton from '@/components/ui/GlowActionButton';
import StepHDetails from '@/components/historical/StepHDetails';
import StepHEvidence from '@/components/historical/StepHEvidence';
import StepHProfile from '@/components/historical/StepHProfile';
import StepHVerifier from '@/components/historical/StepHVerifier';
import StepHReview from '@/components/historical/StepHReview';
import { cn } from '@/lib/utils';
import { Check, CheckCircle2, History, Clock, ShieldCheck, UserCheck, Shield } from 'lucide-react';

/**
 * Add Past Achievement — the historical verification wizard. Five steps:
 * details → private evidence → professional profile → proposed verifier →
 * review. Submission saves the request as Pending Verification and notifies
 * the Super Admin review queue. The nominated verifier has NO authority until
 * a Blockward Super Admin independently authorises them.
 */

const STEPS = [
  { label: 'Achievement details', icon: History },
  { label: 'Evidence', icon: Clock },
  { label: 'Your profile', icon: UserCheck },
  { label: 'Proposed verifier', icon: ShieldCheck },
  { label: 'Review', icon: Shield },
];

const EMPTY = {
  title: '', category: 'other', description: '', original_date: '', issuing_org: '',
  country: '', certificate_ref: '', evidence: [],
  profile_full_name: '', linkedin_url: '', personal_website: '',
  verifier_name: '', verifier_email: '', verifier_role: '', verifier_org: '',
  verifier_linkedin: '', verifier_relationship: '', verifier_authority_claim: '',
};

const LINKEDIN_RE = /^https:\/\/(www\.)?linkedin\.com\/(in|company)\/[A-Za-z0-9_%\-.]+\/?$/i;

function Wizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // { request_ref }
  const [draft, setDraft] = useState(EMPTY);

  const stepValid = [
    draft.title.trim().length >= 3 && !!draft.original_date && draft.issuing_org.trim().length >= 2,
    (draft.evidence || []).length > 0,
    !draft.linkedin_url || LINKEDIN_RE.test(draft.linkedin_url.trim()),
    draft.verifier_name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.verifier_email.trim())
      && draft.verifier_role.trim() && draft.verifier_org.trim() && draft.verifier_authority_claim.trim().length >= 10
      && (!draft.verifier_linkedin || LINKEDIN_RE.test(draft.verifier_linkedin.trim())),
    true,
  ][step];

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('historicalRequestCreate', {
        form: {
          title: draft.title, category: draft.category, description: draft.description,
          original_date: draft.original_date, issuing_org: draft.issuing_org, country: draft.country,
          certificate_ref: draft.certificate_ref,
          evidence: draft.evidence,
          profile: { full_name: draft.profile_full_name, linkedin_url: draft.linkedin_url, personal_website: draft.personal_website },
          verifier: {
            name: draft.verifier_name, email: draft.verifier_email, role: draft.verifier_role,
            org: draft.verifier_org, linkedin: draft.verifier_linkedin,
            relationship: draft.verifier_relationship, authority_claim: draft.verifier_authority_claim,
          },
        },
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Submission failed');
      setDone({ request_ref: res.data.request_ref });
      toast.success('Submitted — saved to your Vault as Pending Verification');
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <div className="max-w-xl mx-auto text-center py-12 animate-fade-in">
        <div className="h-14 w-14 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-5">
          <Check className="h-7 w-7 text-success" />
        </div>
        <h2 className="text-xl font-bold text-foreground tracking-tight">Request submitted</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Your achievement is in your Vault as <span className="text-foreground font-medium">Pending Verification</span>
          {' '}({done.request_ref}). A Blockward Super Admin will now review the verifier you nominated.
          Nothing is verified until the approved verifier confirms it and the credential is issued.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <GlowActionButton size="md" icon={CheckCircle2} label="Open my Vault" to="/StudentBlockWards?tab=pending" />
          <Button variant="outline" onClick={() => { setDraft(EMPTY); setStep(0); setDone(null); }}>Add another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.label}>
            <button type="button" onClick={() => { if (i < step && stepValid !== false) setStep(i); }} className="flex items-center gap-2 flex-shrink-0">
              <span className={cn(
                'h-6 w-6 rounded-full grid place-items-center text-[11px] font-semibold transition-colors',
                i < step ? 'bg-success/15 text-success border border-success/30'
                  : i === step ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-tertiary border border-border',
              )}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn('hidden lg:block text-xs font-medium', i === step ? 'text-foreground' : 'text-tertiary')}>{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
          </React.Fragment>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-6">
        {step === 0 && <StepHDetails draft={draft} setDraft={setDraft} />}
        {step === 1 && <StepHEvidence draft={draft} setDraft={setDraft} />}
        {step === 2 && <StepHProfile draft={draft} setDraft={setDraft} />}
        {step === 3 && <StepHVerifier draft={draft} setDraft={setDraft} />}
        {step === 4 && <StepHReview draft={draft} submitting={submitting} onSubmit={submit} />}

        {step < 4 && (
          <div className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-border">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
            <GlowActionButton size="sm" icon={STEPS[step + 1].icon} label="Continue" arrow disabled={!stepValid} onClick={() => setStep((s) => s + 1)} />
          </div>
        )}
        {step === 4 && (
          <div className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-border">
            <Button variant="ghost" onClick={() => setStep(3)} disabled={submitting}>Back</Button>
            <GlowActionButton size="sm" icon={CheckCircle2} label="Submit for verification" arrow loading={submitting} onClick={submit} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoricalAchievement() {
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <PageHeader
          title="Add a past achievement"
          description="Bring an accomplishment from before BlockWard into your Vault. You nominate who can confirm it — Blockward's review team authorises the verifier, the verifier confirms, and only then is a Verified credential issued."
        />
        <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <ShieldCheck className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground font-medium">Import is not verification.</span> Every submission starts unverified.
            A Super Admin independently checks your proposed verifier, the verifier confirms the achievement, and the
            credential records your original achievement date alongside today's verification date — history is never rewritten.
          </p>
        </div>
        <Wizard />
      </div>
    </ProtectedRoute>
  );
}