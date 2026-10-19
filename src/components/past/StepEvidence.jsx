import React from 'react';
import { Button } from '@/components/ui/button';
import EvidenceUpload from '@/components/evidence/EvidenceUpload';
import { Sparkles, Loader2, Info } from 'lucide-react';

/**
 * StepEvidence — private supporting evidence for a past achievement.
 * Files go to private storage: no public URL exists; the issuer reads them
 * through a permission-checked link during review.
 */
export default function StepEvidence({ draft, setDraft, onExtract, extracting, extractingFrom }) {
  const readable = (draft.evidence || []).filter(
    (e) => /\.(jpe?g|png|webp|pdf)$/i.test(e?.name || '') || (e?.type || '').startsWith('image/'),
  );

  return (
    <div className="space-y-4">
      <EvidenceUpload
        value={draft.evidence || []}
        onChange={(evidence) => setDraft((d) => ({ ...d, evidence }))}
        helpText="PDF certificates, certificate photos, award letters or confirmation emails — stored privately."
      />

      {readable.length > 0 && (
        <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Let Blockward read the certificate</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                We can suggest the title, issuer and date from your document. You review every suggestion
                before submitting — the AI never decides whether an achievement is authentic.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {readable.slice(0, 3).map((e, i) => (
              <Button
                key={e.url || i}
                type="button"
                variant="outline"
                size="sm"
                disabled={extracting}
                onClick={() => onExtract(e)}
              >
                {extracting && extractingFrom === e.url
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                Extract from {e.name?.length > 24 ? `${e.name.slice(0, 24)}…` : (e.name || `file ${i + 1}`)}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info/5 p-3">
        <Info className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Your evidence stays private. Only you, and the authorised issuer reviewing your verification
          request, can view it.
        </p>
      </div>
    </div>
  );
}