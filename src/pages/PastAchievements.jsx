import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import PageHeader from '@/components/ui/page-header';
import GlowActionButton from '@/components/ui/GlowActionButton';
import { Button } from '@/components/ui/button';
import StepDetails from '@/components/past/StepDetails';
import StepEvidence from '@/components/past/StepEvidence';
import StepIssuer from '@/components/past/StepIssuer';
import StepReview from '@/components/past/StepReview';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Check, History } from 'lucide-react';

/**
 * Past Achievements — import achievements earned before joining BlockWard.
 * Import and verification are strictly separated: every submission starts
 * UNVERIFIED and only an authorised issuer's confirmation can produce a
 * Blockward Verified credential. Submission routes by issuer:
 *   • registered & verified org  → verification request straight to them
 *   • unregistered org           → invitation emailed to their official contact
 *   • neither                    → private personal-archive record
 */

const STEPS = ['Achievement details', 'Evidence', 'Find issuer', 'Review & submit'];

function Wizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractingFrom, setExtractingFrom] = useState(null);
  const [done, setDone] = useState(null); // { kind: 'requested'|'invited'|'archived', orgName }
  const [draft, setDraft] = useState({
    title: '', category: 'other', date_achieved: '', issuer_org: '', country: '',
    external_credential_id: '', description: '', evidence: [], org: null, suggested: null,
  });

  const detailsValid = draft.title.trim().length >= 3 && !!draft.date_achieved;

  const onExtract = async (evidenceItem) => {
    setExtracting(true);
    setExtractingFrom(evidenceItem.url);
    try {
      const res = await base44.functions.invoke('extractCertificateDetails', { file_url: evidenceItem.url });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not read the certificate');
      const s = res.data.suggestions || {};
      setDraft((d) => ({
        ...d,
        title: s.title || d.title,
        issuer_org: s.issuer_org || d.issuer_org,
        date_achieved: s.date_achieved || d.date_achieved,
        category: s.category || d.category,
        description: s.description || d.description,
        external_credential_id: s.external_credential_id || d.external_credential_id,
      }));
      toast.success('Details extracted — review them in step 1');
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Could not read the certificate');
    } finally {
      setExtracting(false);
      setExtractingFrom(null);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('createAchievement', {
        title: draft.title.trim(),
        category: draft.category || 'other',
        date_achieved: draft.date_achieved,
        issuer_org: draft.org?.name || draft.suggested?.name || draft.issuer_org.trim(),
        issuer_email: draft.org?.contact_email || null,
        issuer_website: draft.org?.website || null,
        description: draft.description.trim(),
        country: draft.country.trim(),
        external_credential_id: draft.external_credential_id.trim(),
        certificate_url: draft.evidence[0]?.url || null,
        certificate_name: draft.evidence[0]?.name || null,
        evidence: (draft.evidence || []).map((e) => ({ name: e.name, url: e.url })),
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed to save');
      const achievement = res.data.achievement;

      if (draft.org) {
        const rv = await base44.functions.invoke('requestVerification', {
          achievement_id: achievement.id,
          issuer_email: draft.org.contact_email,
        });
        if (!rv.data?.ok) throw new Error(rv.data?.error || 'Could not send the verification request');
        setDone({ kind: 'requested', orgName: draft.org.name });
      } else if (draft.suggested) {
        setDone({ kind: 'invited', orgName: draft.suggested.name });
      } else {
        setDone({ kind: 'archived' });
      }
      toast.success('Saved to your personal archive');
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-xl mx-auto text-center py-12 animate-fade-in">
        <div className="h-14 w-14 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-5">
          <Check className="h-7 w-7 text-success" />
        </div>
        <h2 className="text-xl font-bold text-foreground tracking-tight">Past achievement saved</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {done.kind === 'requested' && (
            <>Your claim has been sent to <span className="text-foreground font-medium">{done.orgName}</span> for review. You'll be notified when they respond — it stays unverified until they confirm it.</>
          )}
          {done.kind === 'invited' && (
            <>We've invited <span className="text-foreground font-medium">{done.orgName}</span> to join BlockWard. Your achievement is safely in your personal archive and becomes verifiable once they register.</>
          )}
          {done.kind === 'archived' && (
            <>It's in your personal archive as <span className="text-foreground font-medium">Self-Reported</span> with your evidence attached privately. You can request verification from the original issuer at any time.</>
          )}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <GlowActionButton size="md" icon={CheckCircle2} label="View my achievements" to="/Achievements" />
          <Button variant="outline" onClick={() => {
            setDone(null); setStep(0);
            setDraft({ title: '', category: 'other', date_achieved: '', issuer_org: '', country: '', external_credential_id: '', description: '', evidence: [], org: null, suggested: null });
          }}>
            Add another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <button
              type="button"
              onClick={() => { if (i < step || (i === 1 && detailsValid)) setStep(i); }}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <span
                className={cn(
                  'h-6 w-6 rounded-full grid place-items-center text-[11px] font-semibold transition-colors',
                  i < step ? 'bg-success/15 text-success border border-success/30'
                    : i === step ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-tertiary border border-border',
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn('hidden sm:block text-xs font-medium', i === step ? 'text-foreground' : 'text-tertiary')}>
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
          </React.Fragment>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-6">
        {step === 0 && <StepDetails draft={draft} setDraft={setDraft} />}
        {step === 1 && (
          <StepEvidence
            draft={draft} setDraft={setDraft}
            onExtract={onExtract} extracting={extracting} extractingFrom={extractingFrom}
          />
        )}
        {step === 2 && <StepIssuer draft={draft} setDraft={setDraft} />}
        {step === 3 && (
          <StepReview draft={draft} onSubmit={submit} onBack={() => setStep(2)} submitting={submitting} />
        )}

        {step < 3 && (
          <div className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-border">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              Back
            </Button>
            <GlowActionButton
              size="sm"
              icon={step === 0 ? History : Clock}
              label="Continue"
              arrow
              disabled={step === 0 && !detailsValid}
              onClick={() => setStep((s) => s + 1)}
            />
          </div>
        )}
        {step === 3 && (
          <div className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-border">
            <Button variant="ghost" onClick={() => setStep(2)} disabled={submitting}>Back</Button>
            <GlowActionButton
              size="sm" icon={CheckCircle2} label="Submit past achievement" arrow loading={submitting}
              disabled={!detailsValid} onClick={submit}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PastAchievements() {
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <PageHeader
          title="Add a past achievement"
          description="Import achievements you earned before joining BlockWard. Importing never verifies anything — only the original issuing organisation can confirm your claim."
        />
        <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <History className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground font-medium">Import ≠ verification.</span> Your achievement enters
            your private archive as Self-Reported. Blockward Verified status comes only after the authorised
            issuer confirms it, and the credential records the original achievement date alongside today's
            verification date — history is never rewritten.
          </p>
        </div>
        <Wizard />
      </div>
    </ProtectedRoute>
  );
}