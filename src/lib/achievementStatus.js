// Centralised achievement/credential status resolution for the UI. Derives a
// human label + semantic styling from real stored state (achievement.status,
// verification request, credential anchor + integrity). Green = genuine
// verified/valid; blue = active/in-progress; amber = pending/attention;
// red = revoked/failed.

import { hasVerifiedIntegrity } from './credentialIntegrity.js';

export const STATUS_META = {
  draft: { label: 'Draft', cls: 'bg-secondary text-muted-foreground border-border', tone: 'neutral' },
  verification_requested: { label: 'Verification requested', cls: 'bg-info/10 text-info border-info/30', tone: 'blue' },
  awaiting_issuer: { label: 'Awaiting issuer', cls: 'bg-warning/10 text-warning border-warning/30', tone: 'amber' },
  awaiting_signature: { label: 'Awaiting signature', cls: 'bg-warning/10 text-warning border-warning/30', tone: 'amber' },
  issuer_verified: { label: 'Issuer verified', cls: 'bg-info/10 text-info border-info/30', tone: 'blue' },
  securing: { label: 'Blockchain pending', cls: 'bg-warning/10 text-warning border-warning/30', tone: 'amber' },
  integrity_pending: { label: 'Blockchain secured', cls: 'bg-info/10 text-info border-info/30', tone: 'blue' },
  blockward_verified: { label: 'Blockward Verified', cls: 'bg-success/10 text-success border-success/30', tone: 'green' },
  anchor_failed: { label: 'Blockchain confirmation delayed', cls: 'bg-destructive/10 text-destructive border-destructive/30', tone: 'red' },
  could_not_verify: { label: 'Could not verify', cls: 'bg-destructive/10 text-destructive border-destructive/30', tone: 'red' },
  expired: { label: 'Expired', cls: 'bg-secondary text-muted-foreground border-border', tone: 'neutral' },
  revoked: { label: 'Revoked', cls: 'bg-destructive/10 text-destructive border-destructive/30', tone: 'red' },
};

export function resolveStatus(item) {
  const a = item || {};
  const c = a.credential;
  const r = a.request;

  if (c?.status === 'revoked' || a.status === 'revoked') return { key: 'revoked', ...STATUS_META.revoked };
  if (a.status === 'rejected') return { key: 'could_not_verify', ...STATUS_META.could_not_verify };

  // Fully verified — issuer confirmed + anchor confirmed + integrity confirmed + active.
  const integrityOk = hasVerifiedIntegrity(c);
  if (a.status === 'verified' || (c?.anchor_status === 'confirmed' && c?.status === 'active')) {
    if (integrityOk) return { key: 'blockward_verified', ...STATUS_META.blockward_verified, detail: 'Integrity confirmed' };
    return { key: 'integrity_pending', ...STATUS_META.integrity_pending, detail: 'Integrity verification required' };
  }

  // Expired.
  if (a.expires_at && new Date(a.expires_at) < new Date() && a.status !== 'verified') {
    return { key: 'expired', ...STATUS_META.expired };
  }

  // Issuer verified but not yet anchored — covers both the brief
  // 'issuer_confirmed' window AND the persistent 'blockchain_processing'
  // state (credential created + queued for Merkle-batch anchoring). Without
  // this, a blockchain_processing achievement falls through to 'draft'.
  if (r?.status === 'approved' && (a.status === 'issuer_confirmed' || a.status === 'blockchain_processing')) {
    if (!c) return { key: 'issuer_verified', ...STATUS_META.issuer_verified, detail: 'Awaiting Blockward organisation approval' };
    if (c.anchor_status === 'failed') return { key: 'anchor_failed', ...STATUS_META.anchor_failed, detail: 'Blockchain confirmation delayed — retrying' };
    if (c.anchor_status === 'processing') return { key: 'securing', ...STATUS_META.securing, detail: 'Blockchain confirmation in progress' };
    if (c.anchor_status === 'pending') return { key: 'securing', ...STATUS_META.securing, detail: 'Awaiting blockchain confirmation — queued for the next batch' };
    return { key: 'integrity_pending', ...STATUS_META.integrity_pending, detail: 'Confirming integrity' };
  }

  // Defensive: credential issued + queued but the VR link is missing — the
  // achievement is clearly mid-issuance, never a draft.
  if (a.status === 'blockchain_processing') {
    if (c?.anchor_status === 'failed') return { key: 'anchor_failed', ...STATUS_META.anchor_failed, detail: 'Blockchain confirmation delayed — retrying' };
    return { key: 'securing', ...STATUS_META.securing, detail: 'Awaiting blockchain confirmation — queued for the next batch' };
  }

  if (a.status === 'verification_requested') {
    if (r && (r.required_signatures || 1) > 1) {
      const done = r.signature_count || 0;
      const need = r.required_signatures;
      return { key: 'awaiting_signature', label: `${done} of ${need} signatures`, cls: STATUS_META.awaiting_signature.cls, tone: 'amber', detail: 'Joint verification' };
    }
    return { key: 'awaiting_issuer', ...STATUS_META.awaiting_issuer };
  }

  if (a.status === 'issuer_confirmed') return { key: 'issuer_verified', ...STATUS_META.issuer_verified };
  return { key: 'draft', ...STATUS_META.draft };
}

export function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return '—'; }
}
export function formatDateTime(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
}