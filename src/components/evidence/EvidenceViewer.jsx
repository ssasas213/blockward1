import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Download, X } from 'lucide-react';
import { getEvidenceSignedUrl, isPrivateEvidence } from '@/lib/evidenceAccess';

function isImage(name) {
  return /\.(jpe?g|png|webp|gif)$/i.test(name || '');
}
function isPdf(name) {
  return /\.pdf$/i.test(name || '');
}

/**
 * EvidenceViewer — full-screen modal viewer for a single private evidence
 * file. Images render at readable size; PDFs render in an iframe. Fetches a
 * permission-checked signed URL (getEvidenceAccess) before showing anything.
 */
export default function EvidenceViewer({ open, onOpenChange, file, context }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !file) return;
    setUrl(null);
    setError('');
    setLoading(true);
    const external = !isPrivateEvidence(file.url);
    if (external) {
      setUrl(file.url);
      setLoading(false);
      return;
    }
    getEvidenceSignedUrl({
      url: file.url,
      achievementId: context?.achievementId,
      requestId: context?.requestId,
      recordId: context?.recordId,
      token: context?.token,
    })
      .then(setUrl)
      .catch((e) => setError(e?.message || 'Could not open this evidence file'))
      .finally(() => setLoading(false));
  }, [open, file, context]);

  if (!file) return null;
  const image = isImage(file.name);
  const pdf = isPdf(file.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] p-0 overflow-hidden gap-0">
        <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-card/60 flex-shrink-0">
          <DialogTitle className="text-sm font-medium text-foreground truncate flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="truncate">{file.name}</span>
          </DialogTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="bg-black/40 flex items-center justify-center overflow-auto" style={{ maxHeight: 'calc(92vh - 4rem)' }}>
          {loading && (
            <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm">Opening evidence…</p>
            </div>
          )}
          {error && (
            <div className="py-24 text-center px-6">
              <p className="text-sm text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground mt-1">You may not have access to this file, or it is no longer available.</p>
            </div>
          )}
          {!loading && !error && url && image && (
            <img src={url} alt={file.name} className="max-w-full max-h-[80vh] object-contain" />
          )}
          {!loading && !error && url && pdf && (
            <iframe src={url} title={file.name} className="w-full bg-white" style={{ height: '80vh', border: 0 }} />
          )}
          {!loading && !error && url && !image && !pdf && (
            <div className="py-24 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-foreground mb-3">{file.name}</p>
              <a href={url} target="_blank" rel="noreferrer" download={file.name}>
                <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Download</Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}