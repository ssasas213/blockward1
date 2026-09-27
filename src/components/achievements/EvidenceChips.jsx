import React, { useState } from 'react';
import { FileText, Link as LinkIcon, Loader2 } from 'lucide-react';
import { isPrivateEvidence, openEvidenceFile } from '@/lib/evidenceAccess';

/**
 * EvidenceChips — renders a request's evidence list. Legacy public files and
 * external links open directly; privately stored files resolve a short-lived
 * signed URL through getEvidenceAccess (owner / nominated verifier /
 * same-school admin / valid external token) on click.
 *
 * variant 'chip'   — bordered buttons (reviewer queue, external verification)
 * variant 'inline' — compact text links (the student's request list)
 */
export default function EvidenceChips({ evidence = [], requestId, recordId, token, variant = 'chip' }) {
  const [opening, setOpening] = useState(null);
  if (!evidence.length) return null;

  const cls = variant === 'inline'
    ? 'inline-flex items-center gap-1 text-primary hover:underline'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground hover:bg-hover transition-colors';

  const open = async (e) => {
    setOpening(e.url);
    await openEvidenceFile({ url: e.url, requestId, recordId, token });
    setOpening(null);
  };

  return (
    <>
      {evidence.map((e, i) => {
        if (isPrivateEvidence(e.url)) {
          const canOpen = !!(requestId || recordId || token);
          return (
            <button
              key={i}
              type="button"
              onClick={canOpen ? () => open(e) : undefined}
              className={`${cls} ${canOpen ? '' : 'opacity-60 cursor-default'}`}
              title={canOpen ? 'Opens a secure, time-limited view' : 'Private file — submit the request to share it with your verifier'}
            >
              {opening === e.url
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <FileText className="h-3.5 w-3.5 text-primary" />}
              {e.name}
            </button>
          );
        }
        return (
          <a key={i} href={e.url} target="_blank" rel="noreferrer" className={cls}>
            {e.type === 'file' ? <FileText className="h-3.5 w-3.5 text-primary" /> : <LinkIcon className="h-3.5 w-3.5 text-primary" />}
            {e.name}
          </a>
        );
      })}
    </>
  );
}