import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, ImageIcon, Eye, Loader2 } from 'lucide-react';
import { getEvidenceSignedUrl, isPrivateEvidence } from '@/lib/evidenceAccess';
import { cn } from '@/lib/utils';

function isImage(name) {
  return /\.(jpe?g|png|webp|gif)$/i.test(name || '');
}
function isPdf(name) {
  return /\.pdf$/i.test(name || '');
}

/** Lazy thumbnail for a single private image evidence file. */
function useSignedThumb(url, context) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!url) return;
    if (!isImage(url) || !isPrivateEvidence(url)) {
      if (!isPrivateEvidence(url) && isImage(url)) setSrc(url);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getEvidenceSignedUrl({
      url,
      achievementId: context?.achievementId,
      requestId: context?.requestId,
      recordId: context?.recordId,
      token: context?.token,
    })
      .then((u) => { if (!cancelled) setSrc(u); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url, context?.achievementId, context?.requestId, context?.recordId, context?.token]);
  return { src, loading };
}

function EvidenceCard({ item, context, onOpen, actions }) {
  const { src, loading } = useSignedThumb(item.url, context);
  const image = isImage(item.name) || isImage(item.url);
  const pdf = isPdf(item.name) || isPdf(item.url);

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <div className="h-11 w-11 flex-shrink-0 rounded-md overflow-hidden border border-border bg-secondary/60 flex items-center justify-center">
        {image && src && <img src={src} alt={item.name} className="h-full w-full object-cover" />}
        {image && loading && <Loader2 className="h-4 w-4 animate-spin text-tertiary" />}
        {image && !src && !loading && <ImageIcon className="h-4 w-4 text-tertiary" />}
        {pdf && <FileText className="h-5 w-5 text-primary" />}
        {!image && !pdf && <FileText className="h-5 w-5 text-tertiary" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground truncate">{item.name}</p>
        <p className="text-[11px] text-tertiary uppercase tracking-wide">
          {pdf ? 'PDF' : image ? 'Image' : 'Document'}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {actions}
        <Button type="button" size="sm" variant="ghost" onClick={() => onOpen(item)} className="h-8 px-2">
          <Eye className="h-4 w-4 mr-1" /> View
        </Button>
      </div>
    </div>
  );
}

/**
 * EvidencePreview — read-only list of evidence files (saved records).
 * Shows a thumbnail for images, a PDF representation for documents, with a
 * View action that opens the EvidenceViewer. Used by Achievement Detail and
 * the Verifier review screen.
 *
 * Props:
 *  - items: [{ name, url }]
 *  - context: { achievementId, requestId, recordId, token }
 *  - className
 *  - emptyText
 */
export default function EvidencePreview({ items, context, className, emptyText = 'No evidence attached.' }) {
  const [viewer, setViewer] = useState(null);
  const list = (items || []).filter((e) => e && e.url);
  if (!list.length) return <p className="text-sm text-tertiary py-2">{emptyText}</p>;

  return (
    <>
      <div className={cn('space-y-1.5', className)}>
        {list.map((item, i) => (
          <EvidenceCard key={(item.url || '') + i} item={item} context={context} onOpen={setViewer} />
        ))}
      </div>
      {viewer && (
        <EvidenceViewerLazy item={viewer} context={context} onClose={() => setViewer(null)} />
      )}
    </>
  );
}

// Lightweight import wrapper to avoid a circular concern.
import EvidenceViewer from './EvidenceViewer';
function EvidenceViewerLazy({ item, context, onClose }) {
  return <EvidenceViewer open={!!item} onOpenChange={(v) => !v && onClose()} file={item} context={context} />;
}