import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * evidenceAccess — client helpers for achievement evidence files.
 *
 * NEW evidence uploads go to PRIVATE storage: the stored value is a private
 * file URI, not a URL — it is worthless without a permission-checked signed
 * URL from getEvidenceAccess (student owner / nominated verifier /
 * same-school admin / valid external-verification token). Legacy evidence
 * uploaded before the privacy migration keeps its permanent public URL and
 * continues to open directly.
 */
export function isPrivateEvidence(url) {
  return !!url && !/^https?:\/\//i.test(url);
}

/**
 * getEvidenceSignedUrl — fetch a time-limited signed URL for a private
 * evidence file WITHOUT opening it. Used by inline thumbnails and the
 * in-app evidence viewer. Same permission checks as openEvidenceFile.
 */
export async function getEvidenceSignedUrl({ url, requestId, recordId, achievementId, token }) {
  const res = await base44.functions.invoke('getEvidenceAccess', {
    request_id: requestId || null,
    record_id: recordId || null,
    achievement_id: achievementId || null,
    file_uri: url,
    token: token || null,
  });
  if (!res?.data?.ok || !res.data.signed_url) {
    throw new Error(res?.data?.error || 'Could not access this evidence file');
  }
  return res.data.signed_url;
}

export async function openEvidenceFile({ url, requestId, recordId, achievementId, token }) {
  try {
    const res = await base44.functions.invoke('getEvidenceAccess', {
      request_id: requestId || null,
      record_id: recordId || null,
      achievement_id: achievementId || null,
      file_uri: url,
      token: token || null,
    });
    if (!res?.data?.ok || !res.data.signed_url) {
      throw new Error(res?.data?.error || 'Could not open this evidence file');
    }
    window.open(res.data.signed_url, '_blank', 'noopener');
    return true;
  } catch (e) {
    toast.error(e?.response?.data?.error || e?.message || 'Could not open this evidence file');
    return false;
  }
}