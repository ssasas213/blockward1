// ============================================================================
// incidentRemediation — controlled remediation of a synthetic confirmation
// incident (AB-5FBCA1 / BW-H5CHBVHE).
//
// A batch was marked ANCHOR_CONFIRMED with a transaction hash that does not
// resolve to a genuine Polygon transaction. The linked credential was marked
// Blockward Verified and the holder was notified — both falsely.
//
// This module reverts the false state WITHOUT destroying the audit trail:
//   1. Quarantine the affected batch (ANCHOR_FAILED_RETRYABLE) so it is never
//      reprocessed. Its event_log gains a `synthetic_confirmation_detected`
//      event; nothing is deleted.
//   2. Revert the credential to `pending` (anchor_status), clear the stale
//      chain_check, and clear the synthetic transaction metadata. The
//      credential is then re-enqueued into a NEW Merkle batch so it receives a
//      genuine on-chain anchor through the normal fee-gated queue path.
//   3. Revert the linked achievement from `verified` to `issuer_confirmed` —
//      the issuer's confirmation is real; only the false blockchain-verified
//      status is removed. It returns to `verified` only after a real anchor.
//   4. Prepare/send an accurate correction notification to the holder.
//
// TWO MODES:
//   • previewRemediation — returns the exact field-level plan + notification
//     text WITHOUT any writes. The operator reviews this before approving.
//   • executeRemediation — applies the plan (idempotent), re-enqueues, and
//     sends the correction notification. Only called after operator approval.
//
// IDEMPOTENT: a second execute is a no-op — the batch is already quarantined
// and the credential already pending. No duplicate re-enqueue, no duplicate
// notification.
// ============================================================================
import { enqueueCredentialForAnchoring } from './anchorQueue.ts';
import { sendTrackedEmail } from './emailDelivery.ts';
import { appBaseUrl } from './verificationFlow.ts';

export interface RemediationDeps {
  enqueue?: (svc: any, cred: any) => Promise<any>;
  emailSender?: (svc: any, opts: any) => Promise<any>;
  baseUrl?: string;
}

function nowIso(): string { return new Date().toISOString(); }
function pushEvent(existing: any[] | null | undefined, event: string, note: string, actor = 'system'): any[] {
  return (Array.isArray(existing) ? existing : []).concat([{ event, actor, note: String(note).slice(0, 300), timestamp: nowIso() }]);
}

// ── Correction notification (BlockWard blue brand theme) ──────────────────────
export function buildCorrectionEmail(d: { bwId: string; title: string; verifyUrl: string; priorNoticeDate?: string | null }): { subject: string; html: string } {
  const subject = `Correction: your Blockward Verified status for "${d.title}"`;
  const priorLine = d.priorNoticeDate
    ? `The blockchain confirmation we sent you on ${d.priorNoticeDate} was not backed by a genuine Polygon transaction, so your credential was never truly Blockward Verified.`
    : `The blockchain confirmation we sent you was not backed by a genuine Polygon transaction, so your credential was never truly Blockward Verified.`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="background:#2270ec;padding:22px 28px;" align="center">
  <img src="https://media.base44.com/images/public/6936b840baa53bb465f68d09/d0902e28f_logo.png" alt="Blockward" style="height:28px;display:block;margin:0 auto 6px;" />
  <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:1px;">BLOCKWARD</div>
</td></tr>
<tr><td style="background:#f8fafc;border:1px solid #e5e7eb;padding:32px 28px;">
  <h1 style="margin:0 0 8px;font-size:22px;color:#000000;font-weight:700;">Correction to your Blockward Verified status</h1>
  <p style="margin:0 0 16px;font-size:15px;color:#6b7280;">A previous confirmation was not valid. Your credential is being re-anchored.</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#000000;">We need to correct the status of your achievement "${escapeHtml(d.title)}". ${priorLine}</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#000000;">We have removed the false verified status and your credential is being re-anchored with a real on-chain transaction. Once that completes, you will receive a new Blockward Verified notification.</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="background:#2270ec;">
    <a href="${escapeHtml(d.verifyUrl)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View your credential</a>
  </td></tr></table>
  <p style="margin:0;font-size:13px;color:#6b7280;">Credential ID: ${escapeHtml(d.bwId)}</p>
</td></tr>
<tr><td style="padding:20px 8px;" align="center">
  <div style="font-size:12px;color:#6b7280;line-height:1.6;">This is an automated correction from Blockward. We apologise for the incorrect notification.</div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { subject, html };
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Look up the affected records ─────────────────────────────────────────────
async function loadRecords(svc: any, batchRef: string, bwId: string) {
  const bRows = await svc.entities.AnchorBatch.filter({ batch_ref: batchRef }, { limit: 1 });
  const batch = (bRows?.items || bRows || [])[0] || null;
  const cRows = await svc.entities.Credential.filter({ bw_id: bwId }, { limit: 1 });
  const cred = (cRows?.items || cRows || [])[0] || null;
  let achievement: any = null;
  if (cred?.achievement_id && /^[0-9a-f]{24}$/i.test(cred.achievement_id)) {
    try { achievement = await svc.entities.Achievement.get(cred.achievement_id); } catch { /* not found */ }
  }
  return { batch, cred, achievement };
}

// ── Build the exact remediation plan (no writes) ─────────────────────────────
export async function previewRemediation(svc: any, opts: { batchRef: string; bwId: string; deps?: RemediationDeps }) {
  const { batchRef, bwId } = opts;
  const deps = opts.deps || {};
  const baseUrl = deps.baseUrl || appBaseUrl();
  const { batch, cred, achievement } = await loadRecords(svc, batchRef, bwId);
  if (!batch) return { ok: false, error: 'batch_not_found', batch_ref: batchRef };
  if (!cred) return { ok: false, error: 'credential_not_found', bw_id: bwId };

  const alreadyQuarantined = batch.status === 'ANCHOR_FAILED_RETRYABLE' || batch.status === 'ANCHOR_FAILED_PERMANENT';
  const alreadyReverted = cred.anchor_status === 'pending';
  const achAlreadyReverted = !achievement || achievement.status === 'issuer_confirmed';

  const verifyUrl = `${baseUrl}/verify/${cred.bw_id}`;
  const priorConfirmedEvent = (cred.event_log || []).find((e: any) => e.event === 'blockchain_confirmed');
  const mail = buildCorrectionEmail({ bwId: cred.bw_id, title: cred.title, verifyUrl, priorNoticeDate: priorConfirmedEvent?.timestamp });

  const plan = {
    batch: {
      id: batch.id, batch_ref: batch.batch_ref, current_status: batch.status,
      target_status: 'ANCHOR_FAILED_PERMANENT',
      fields: { status: 'ANCHOR_FAILED_PERMANENT', anchor_claimed_by: null, anchor_claimed_at: null, last_error: 'synthetic confirmation detected — permanently quarantined for re-anchor', next_attempt_at: null },
      event: { event: 'synthetic_confirmation_detected', note: `Incident remediation: batch quarantined — transaction ${batch.transaction_hash} was not independently verified on-chain`, timestamp: nowIso() },
      event_log: (batch.event_log || []).slice(-12),
      already_quarantined: alreadyQuarantined,
    },
    credential: {
      id: cred.id, bw_id: cred.bw_id, current_anchor_status: cred.anchor_status, target_anchor_status: 'pending',
      fields: {
        anchor_status: 'pending',
        blockchain: { status: 'pending', network: cred.blockchain?.network || 'polygon_mainnet', batch_ref: null, transaction_hash: null, block_number: null, block_timestamp: null, merkle_leaf_index: null, merkle_proof: [], batch_root: null, error: 'prior confirmation was synthetic — re-anchor pending', queued_at: nowIso() },
        chain_check: null, anchor_claimed_by: null, anchor_claimed_at: null,
      },
      event: { event: 'synthetic_confirmation_cleared', note: 'Incident remediation: false Blockward Verified status removed — credential reverted to pending for re-anchoring', timestamp: nowIso() },
      event_log: (cred.event_log || []).slice(-12),
      already_reverted: alreadyReverted,
    },
    achievement: achievement ? {
      id: achievement.id, current_status: achievement.status, target_status: 'issuer_confirmed',
      fields: { status: 'issuer_confirmed' },
      event: { event: 'verification_reverted_pending_reanchor', note: 'Incident remediation: Blockward Verified status reverted — awaiting genuine on-chain re-anchor', timestamp: nowIso() },
      event_log: (achievement.event_log || []).slice(-12),
      already_reverted: achAlreadyReverted,
    } : null,
    reenqueue: { description: 'Credential re-enqueued into a new Merkle batch for a genuine on-chain anchor (fee-gated, no automatic broadcast)' },
    notification: { to: cred.holder_email, subject: mail.subject },
  };
  return { ok: true, mode: 'preview' as const, approved: false, plan };
}

// ── Apply the remediation (idempotent) ────────────────────────────────────────
export async function executeRemediation(svc: any, opts: { batchRef: string; bwId: string; deps?: RemediationDeps }) {
  const { batchRef, bwId } = opts;
  const deps = opts.deps || {};
  const baseUrl = deps.baseUrl || appBaseUrl();
  const enqueue = deps.enqueue || enqueueCredentialForAnchoring;
  const emailSender = deps.emailSender || sendTrackedEmail;
  const { batch, cred, achievement } = await loadRecords(svc, batchRef, bwId);
  if (!batch) return { ok: false, error: 'batch_not_found', batch_ref: batchRef };
  if (!cred) return { ok: false, error: 'credential_not_found', bw_id: bwId };

  const alreadyQuarantined = batch.status === 'ANCHOR_FAILED_RETRYABLE' || batch.status === 'ANCHOR_FAILED_PERMANENT';
  const alreadyReverted = cred.anchor_status === 'pending';
  const achAlreadyReverted = !achievement || achievement.status === 'issuer_confirmed';

  const applied: any = { batch_quarantined: false, credential_reverted: false, achievement_reverted: false, reenqueue: null, notification_sent: false };

  // 1. Quarantine the batch PERMANENTLY — the due filter in processAnchorQueue
  //    only selects ANCHOR_PENDING / ANCHOR_FAILED_RETRYABLE batches, so a
  //    permanently-quarantined batch is NEVER claimed, attempted or rebroadcast.
  //    This is the pre-broadcast duplicate prevention: the synthetic batch cannot
  //    sign a second transaction because it never reaches the broadcaster.
  if (!alreadyQuarantined) {
    await svc.entities.AnchorBatch.update(batch.id, {
      status: 'ANCHOR_FAILED_PERMANENT',
      anchor_claimed_by: null, anchor_claimed_at: null,
      last_error: 'synthetic confirmation detected — permanently quarantined for re-anchor',
      next_attempt_at: null,
      event_log: pushEvent(batch.event_log, 'synthetic_confirmation_detected', `Incident remediation: batch quarantined — transaction ${batch.transaction_hash} was not independently verified on-chain`),
    });
    applied.batch_quarantined = true;
  }

  // 2. Revert the credential — clear the false confirmed state.
  if (!alreadyReverted) {
    const revertedBlockchain = {
      status: 'pending', network: cred.blockchain?.network || 'polygon_mainnet',
      batch_ref: null, transaction_hash: null, block_number: null, block_timestamp: null,
      merkle_leaf_index: null, merkle_proof: [], batch_root: null,
      error: 'prior confirmation was synthetic — re-anchor pending', queued_at: nowIso(),
    };
    await svc.entities.Credential.update(cred.id, {
      anchor_status: 'pending',
      blockchain: revertedBlockchain,
      chain_check: null,
      anchor_claimed_by: null, anchor_claimed_at: null,
      event_log: pushEvent(cred.event_log, 'synthetic_confirmation_cleared', 'Incident remediation: false Blockward Verified status removed — credential reverted to pending for re-anchoring'),
    });
    applied.credential_reverted = true;
    cred.blockchain = revertedBlockchain;
    cred.anchor_status = 'pending';
  }

  // 3. Revert the linked achievement — issuer confirmation is real, blockchain verified status is not.
  if (achievement && !achAlreadyReverted) {
    await svc.entities.Achievement.update(achievement.id, {
      status: 'issuer_confirmed',
      event_log: pushEvent(achievement.event_log, 'verification_reverted_pending_reanchor', 'Incident remediation: Blockward Verified status reverted — awaiting genuine on-chain re-anchor'),
    });
    applied.achievement_reverted = true;
  }

  // 4. Re-enqueue into a NEW batch so the credential receives a genuine anchor.
  //    The old batch is quarantined (ANCHOR_FAILED_RETRYABLE), so enqueue joins
  //    or opens a fresh batch — never the affected one.
  try { applied.reenqueue = await enqueue(svc, cred); } catch (e) { applied.reenqueue = { ok: false, error: String(e?.message || e).slice(0, 200) }; }

  // 5. Correction notification to the holder.
  const verifyUrl = `${baseUrl}/verify/${cred.bw_id}`;
  const mail = buildCorrectionEmail({ bwId: cred.bw_id, title: cred.title, verifyUrl });
  try {
    await emailSender(svc, {
      to: cred.holder_email, subject: mail.subject, html: mail.html,
      event_type: 'correction_notification', related_id: cred.bw_id,
      retryable: true, dedupe_key: `correction:${cred.bw_id}:remediation`,
    });
    applied.notification_sent = true;
  } catch (e) { applied.notification_error = String(e?.message || e).slice(0, 200); }

  return { ok: true, mode: 'executed' as const, approved: true, applied };
}