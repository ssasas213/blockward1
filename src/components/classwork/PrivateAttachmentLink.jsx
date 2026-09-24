import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Paperclip, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * PrivateAttachmentLink — opens a submission attachment.
 * New submissions are stored in PRIVATE storage: the stored URI is not a URL,
 * so clicking asks getFileAccess for a short-lived signed URL after a
 * server-side permission check. Legacy public file URLs open directly.
 */
export default function PrivateAttachmentLink({ attachment, submissionId, className }) {
  const [busy, setBusy] = useState(false);
  const isPrivate = !!attachment.private || !/^https?:\/\//i.test(attachment.url || '');

  const open = async (e) => {
    if (!isPrivate) return; // public URL — let the browser handle it
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('getFileAccess', {
        submission_id: submissionId,
        file_uri: attachment.url,
      });
      if (res.data?.ok) {
        window.open(res.data.signed_url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error(res.data?.error || 'You do not have access to this file');
      }
    } catch (err) {
      toast.error('Could not open this file');
    } finally {
      setBusy(false);
    }
  };

  return (
    <a
      href={isPrivate ? '#' : attachment.url}
      onClick={open}
      target="_blank"
      rel="noopener noreferrer"
      className={className || 'inline-flex items-center gap-1.5 text-sm text-primary hover:underline'}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
      {attachment.name || 'Attachment'}
    </a>
  );
}