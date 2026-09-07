import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { OPPORTUNITY_TYPE_LABELS, formatDeadline } from '@/lib/opportunities';

/**
 * ApplyDialog — answers the listing's application questions and submits.
 * The applicant's verified credentials are attached automatically, which
 * the dialog makes explicit up front (no CV upload).
 */
export default function ApplyDialog({ opportunity, open, onOpenChange, onApplied, myVerifiedCount = 0 }) {
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) { setAnswers({}); setError(null); }
  }, [open, opportunity?.id]);

  if (!opportunity) return null;
  const questions = opportunity.application_questions || [];

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('opportunityAction', {
        action: 'apply',
        opportunity_id: opportunity.id,
        answers: questions.map((q) => ({ question: q.question, answer: answers[q.question] || '' })),
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not submit your application.');
      toast({
        title: 'Application sent',
        description: `${myVerifiedCount} verified credential${myVerifiedCount === 1 ? '' : 's'} attached automatically.`,
      });
      onApplied();
      onOpenChange(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply — {opportunity.title}</DialogTitle>
          <DialogDescription>
            {opportunity.organisation_name} · {OPPORTUNITY_TYPE_LABELS[opportunity.type] || opportunity.type}
            {opportunity.application_deadline ? ` · Deadline ${formatDeadline(opportunity.application_deadline)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
          <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-foreground">
            Your <span className="font-semibold">{myVerifiedCount}</span> verified credential
            {myVerifiedCount === 1 ? '' : 's'} will be attached to this application automatically — no CV needed.
          </p>
        </div>

        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">This opportunity has no application questions.</p>
        ) : (
          <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
            {questions.map((q, i) => (
              <div key={i} className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  {q.question}
                  {q.required && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Required</Badge>}
                </Label>
                <Textarea
                  value={answers[q.question] || ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.question]: e.target.value }))}
                  placeholder="Your answer"
                  rows={3}
                />
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Sending…' : 'Submit application'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}