import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import EvidenceUpload from '@/components/evidence/EvidenceUpload';
import { Link2, X, Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/** Step 2 — private evidence. Uploads go to PRIVATE storage (no public URL —
 *  access follows the app's permissions, via permission-checked signed links).
 *  Official verification URLs (https) are also accepted. AI extraction only
 *  suggests details for the student to review — it never decides authenticity. */
export default function StepHEvidence({ draft, setDraft }) {
  const [linkUrl, setLinkUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractingFrom, setExtractingFrom] = useState(null);

  const addLink = () => {
    const url = linkUrl.trim();
    if (!/^https:\/\/\S+/.test(url)) { toast.error('Official verification links must be https URLs'); return; }
    if ((draft.evidence || []).some((e) => e.url === url)) { toast.error('That link is already added'); return; }
    setDraft((d) => ({ ...d, evidence: [...(d.evidence || []), { name: 'Official verification link', url, kind: 'link' }] }));
    setLinkUrl('');
  };

  const readable = (draft.evidence || []).filter((e) => e.kind !== 'link' && /^https:/i.test(e.url || ''));

  const onExtract = async (item) => {
    setExtracting(true); setExtractingFrom(item.url);
    try {
      const res = await base44.functions.invoke('extractCertificateDetails', { file_url: item.url });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not read the certificate');
      const s = res.data.suggestions || {};
      setDraft((d) => ({
        ...d,
        title: s.title || d.title, issuing_org: s.issuer_org || d.issuing_org,
        original_date: s.date_achieved || d.original_date, category: s.category && s.category !== 'award' ? s.category : d.category,
        description: s.description || d.description, certificate_ref: s.external_credential_id || d.certificate_ref,
      }));
      toast.success('Details extracted — review them in step 1');
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Could not read the certificate');
    } finally { setExtracting(false); setExtractingFrom(null); }
  };

  return (
    <div className="space-y-4">
      <EvidenceUpload
        value={draft.evidence || []}
        onChange={(evidence) => setDraft((d) => ({ ...d, evidence: evidence.map((e) => ({ ...e, kind: e.kind || 'file' })) }))}
        helpText="PDF certificates, certificate photos, award letters or confirmation emails — stored privately."
      />

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-primary" /> Official verification URL (optional)
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.org/verify/ABC123"
            className="flex-1 h-9 px-3 rounded-lg bg-secondary/60 border border-border text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
          />
          <Button type="button" variant="secondary" size="sm" onClick={addLink} disabled={!linkUrl.trim()}>Add</Button>
        </div>
      </div>

      {(draft.evidence || []).filter((e) => e.kind === 'link').map((e, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm">
          <Link2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <a href={e.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-foreground hover:underline">{e.url}</a>
          <button onClick={() => setDraft((d) => ({ ...d, evidence: d.evidence.filter((x) => x !== e) }))} aria-label="Remove link">
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}

      {readable.length > 0 && (
        <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Let Blockward read the certificate</p>
              <p className="text-xs text-muted-foreground mt-0.5">Suggestions only — you review everything before submitting.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {readable.slice(0, 3).map((e, i) => (
              <Button key={e.url || i} type="button" variant="outline" size="sm" disabled={extracting} onClick={() => onExtract(e)}>
                {extracting && extractingFrom === e.url ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                Extract from {e.name?.length > 24 ? `${e.name.slice(0, 24)}…` : (e.name || `file ${i + 1}`)}
              </Button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Your evidence stays private. Only you, the Blockward review team and the approved verifier can view it, through expiring permission-checked links.</p>
    </div>
  );
}