// ============================================================================
// anchorQueue — the durable, database-backed Polygon anchoring queue.
//
// CREDENTIALS ARE BATCHED: verified credential commitments (BW-HASH-V1 leaves)
// are grouped into Merkle batches; ONE transaction anchors the batch root;
// every credential receives an independently verifiable inclusion proof.
// 1,000 verified achievements can share one transaction instead of 1,000.
//
// QUEUE STATUSES (on AnchorBatch): ANCHOR_PENDING → ANCHOR_PROCESSING →
// ANCHOR_SUBMITTED → ANCHOR_CONFIRMED, with ANCHOR_PENDING_FEE (gas policy
// gate — the credential is preserved and retried when fees allow),
// ANCHOR_FAILED_RETRYABLE (exponential backoff) and ANCHOR_FAILED_PERMANENT
// (administrator intervention required). Nothing is ever silently lost:
// stale locks are recovered, submitted-but-unreceipted transactions are
// reconciled, and escalation/critical windows alert administrators.
//
// The worker (processAnchorQueue) is re-entrant and safe to run from the
// scheduled workflow every 5 minutes AND on demand (admin retry) — every
// state transition is a conditional claim, so concurrent workers cannot
// anchor a batch twice.
// ============================================================================
import { createPublicClient, http } from 'npm:viem@2.7.0';
import { merkleRoot, merkleProof, verifyMerkleProof } from './anchorMerkle.ts';
import { computeCredentialHash, CREDENTIAL_HASH_VERSION } from './credentialHash.ts';
import { anchorBatchRoot, resolvePolygonTarget, resolvePolygonConfig, BATCH_ANCHOR_VERSION, verifyBatchRootOnChain, type TargetNetwork } from './chainPolygon.ts';

// ── Broadcaster dependency injection (incident §4/§5) ─────────────────────────
// Production uses the real anchorBatchRoot (network-pinned to the batch's own
// network). A test-injected mock never signs and never touches an RPC — it
// returns a deterministic confirmed result so the finalize/proof path runs
// end-to-end without any possibility of a production broadcast. This is the
// PERMANENT SEPARATION between test execution and production broadcasting.
export type BatchBroadcaster = (opts: { rootHex: string; memberCount: number; target: TargetNetwork }) => Promise<any>;
const defaultBroadcaster: BatchBroadcaster = async (o) => anchorBatchRoot(o);
import { verificationBindings } from './chainVerification.ts';
import {
  resolveAnchorPolicy, estimateBatchGas, gweiToWeiPerGas, weiToPol, weiToUsd,
  feeDecision, backoffSeconds, polUsdPrice,
} from './anchorGasPolicy.ts';
import { sendTrackedEmail } from './emailDelivery.ts';
import { holderVerifiedEmail } from './issuerEmails.ts';
import { notifyHolder, appBaseUrl } from './verificationFlow.ts';
import { notifyAnchorAdmins } from './anchorAlerts.ts';
import { runGasFeeMonitoring } from './gasFeeMonitor.ts';

const CLAIM_STALE_MS = 10 * 60 * 1000;
const SUBMIT_RECONCILE_MAX_MINUTES = 30;

// Resolve a batch's close_at. Event-driven mode (flushDebounceSeconds > 0)
// makes a new batch due in seconds so the "Anchor Batch Flush" workflow can
// force-flush it promptly; legacy mode keeps the configured batching window.
// Either way the 5-min scheduled worker remains the recovery path.
function batchCloseAt(policy: any, fromMs: number = Date.now()): string {
  const debounce = Number(policy?.flushDebounceSeconds || 0);
  const ms = debounce > 0 ? debounce * 1000 : policy.batchWindowMinutes * 60000;
  return new Date(fromMs + ms).toISOString();
}
function batchWindowLabel(policy: any): string {
  const debounce = Number(policy?.flushDebounceSeconds || 0);
  return debounce > 0 ? `flush ${debounce}s (event-driven)` : `window ${policy.batchWindowMinutes} min`;
}

function nowIso(): string { return new Date().toISOString(); }
function log(step: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: 'anchorQueue', step, ...extra }));
}
function pushBatchEvent(existing: any[] | null | undefined, event: string, note = ''): any[] {
  return (Array.isArray(existing) ? existing : []).concat([{ event, actor: 'system', note: String(note).slice(0, 300), timestamp: nowIso() }]);
}
async function items(filter: any, opts: any = {}, svc?: any): Promise<any[]> {
  const page = await svc.entities.AnchorBatch.filter(filter, opts);
  return page?.items || (Array.isArray(page) ? page : []);
}

async function generateBatchRef(svc: any): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const ref = 'AB-' + crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
    const exists = await svc.entities.AnchorBatch.filter({ batch_ref: ref }, { limit: 1 });
    if ((exists?.items || exists || []).length === 0) return ref;
  }
  return 'AB-' + Date.now().toString(36).toUpperCase().slice(-6);
}

// Administrator alerting lives in ./anchorAlerts.ts (shared with the read-only
// gas-fee monitor) — see notifyAnchorAdmins.

// ── ENQUEUE ──────────────────────────────────────────────────────────────────
// Called by the single issuance pipeline (credentialIssuance) for EVERY newly
// verified credential. Joins the oldest open batch on the target network, or
// opens a new one with the configured batching window.
export async function enqueueCredentialForAnchoring(svc: any, cred: any) {
  try {
    const resolved = resolvePolygonTarget();
    if ('unsupported' in resolved) return { ok: false, error: 'unsupported_network', value: resolved.value };
    const target = resolved.target;
    const policy = resolveAnchorPolicy();
    const nowIsoStr = nowIso();

    const open = await svc.entities.AnchorBatch.filter(
      { status: 'ANCHOR_PENDING', network: target }, { sort: 'created_date', limit: 5 });
    const openItems = open?.items || open || [];
    let batch = openItems.find((b: any) => (b.member_ids || []).length < policy.batchMaxSize) || null;

    if (!batch) {
      batch = await svc.entities.AnchorBatch.create({
        batch_ref: await generateBatchRef(svc),
        status: 'ANCHOR_PENDING',
        network: target,
        member_ids: [],
        member_count: 0,
        max_size: policy.batchMaxSize,
        created_at: nowIsoStr,
        close_at: batchCloseAt(policy),
        attempts: 0,
        event_log: pushBatchEvent(null, 'opened', `network ${target}, ${batchWindowLabel(policy)}, max ${policy.batchMaxSize}`),
      });
    }

    const memberIds = [...(batch.member_ids || []), cred.id];
    await svc.entities.AnchorBatch.update(batch.id, {
      member_ids: memberIds,
      member_count: memberIds.length,
      event_log: pushBatchEvent(batch.event_log, 'member_added', cred.bw_id),
    });

    await svc.entities.Credential.update(cred.id, {
      anchor_status: 'pending',
      // Pin the target network at enqueue so a pending credential resolves to
      // the correct chain on the public page (resolveVerificationTarget reads
      // blockchain.network), not the conservative Amoy default. The batch's own
      // network field is the source of truth; this mirrors it onto the member.
      blockchain: { ...(cred.blockchain || {}), status: 'pending', network: target, batch_ref: batch.batch_ref, queued_at: nowIsoStr },
      event_log: (cred.event_log || []).concat([{
        event: 'blockchain_queued', actor: 'system',
        note: `Anchoring queued — batch ${batch.batch_ref} on ${target}`,
        timestamp: nowIsoStr,
      }]),
    });

    log('enqueued', { bw_id: cred.bw_id, batch_ref: batch.batch_ref, members: memberIds.length, flush: policy.flushDebounceSeconds > 0 });
    return {
      ok: true, queued: true, batch_ref: batch.batch_ref,
      close_at: batch.close_at, network: target,
      target_minutes: policy.targetMinutes,
      event_driven: policy.flushDebounceSeconds > 0,
    };
  } catch (e) {
    log('enqueue_error', { err: String(e?.message || e).slice(0, 200) });
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

// ── WORKER ───────────────────────────────────────────────────────────────────
export async function processAnchorQueue(svc: any, opts: { forceBatchRef?: string | null; broadcaster?: BatchBroadcaster } = {}) {
  const policy = resolveAnchorPolicy();
  const broadcaster = opts.broadcaster; // undefined = production (real broadcaster + fee gate)
  const summary: any = {
    reconciled: 0, confirmed: 0, fee_holds: 0, fee_released: 0,
    escalated: 0, critical: 0, attempted: 0, recovered: 0, errors: [],
  };
  const nowMs = Date.now();

  try {
    // 1. Reconcile SUBMITTED transactions — a crash between broadcast and
    //    receipt, an RPC outage during receipt wait, or a normal in-flight tx.
    const submitted = await items({ status: 'ANCHOR_SUBMITTED' }, { limit: 20 }, svc);
    for (const batch of submitted) {
      try { await reconcileSubmitted(svc, batch, policy, summary); } catch (e) {
        summary.errors.push(`reconcile ${batch.batch_ref}: ${String(e?.message || e).slice(0, 120)}`);
      }
    }

    // 2. Stale-lock recovery — a worker that died mid-attempt (claim >10 min).
    const processing = await items({ status: 'ANCHOR_PROCESSING' }, { limit: 20 }, svc);
    for (const batch of processing) {
      const age = batch.anchor_claimed_at ? nowMs - new Date(batch.anchor_claimed_at).getTime() : Infinity;
      if (age >= CLAIM_STALE_MS) {
        await svc.entities.AnchorBatch.update(batch.id, {
          status: 'ANCHOR_FAILED_RETRYABLE',
          attempts: (batch.attempts || 0) + 1,
          next_attempt_at: new Date(nowMs + 60000).toISOString(),
          anchor_claimed_by: null, anchor_claimed_at: null,
          last_error: 'stale lock recovered after worker loss',
          event_log: pushBatchEvent(batch.event_log, 'retry_scheduled', 'stale lock recovered — retrying'),
        });
        summary.recovered++;
      }
    }

    // 3. Escalation & critical-incident scan — never a silent permanent queue.
    const watched = await items(
      { status: { $in: ['ANCHOR_PENDING', 'ANCHOR_PENDING_FEE', 'ANCHOR_FAILED_RETRYABLE'] } }, { limit: 200 }, svc);
    for (const batch of watched) {
      const ageMin = (nowMs - new Date(batch.created_at || batch.created_date).getTime()) / 60000;
      if (ageMin >= policy.escalationMinutes && !batch.escalated_at) {
        await svc.entities.AnchorBatch.update(batch.id, {
          escalated_at: nowIso(),
          event_log: pushBatchEvent(batch.event_log, 'escalated', `batch age ${Math.round(ageMin)} min exceeded escalation target`),
        });
        await notifyAnchorAdmins(svc, 'Anchoring escalation',
          `Batch ${batch.batch_ref} (${batch.member_count} credentials) has waited ${Math.round(ageMin)} minutes without an anchor. Queue will force attempts past the per-batch fee budget.`,
          'anchor_escalation', 'important');
        summary.escalated++;
      }
      if (ageMin >= policy.criticalMinutes && !batch.critical_at) {
        await svc.entities.AnchorBatch.update(batch.id, {
          critical_at: nowIso(),
          event_log: pushBatchEvent(batch.event_log, 'critical', `batch age ${Math.round(ageMin)} min — CRITICAL incident`),
        });
        await notifyAnchorAdmins(svc, 'CRITICAL: anchoring incident',
          `Batch ${batch.batch_ref} has not anchored for ${Math.round(ageMin / 60)} hours. Last error: ${batch.last_error || 'none'}. Immediate administrator attention required.`,
          'anchor_critical', 'urgent');
        summary.critical++;
      }
    }

    // 4. Fee-hold release — fee-gated batches re-check every tick.
    const feeHeld = await items({ status: 'ANCHOR_PENDING_FEE' }, { limit: 50 }, svc);
    for (const batch of feeHeld) {
      await svc.entities.AnchorBatch.update(batch.id, {
        status: 'ANCHOR_PENDING',
        next_attempt_at: nowIso(),
        event_log: pushBatchEvent(batch.event_log, 'fee_released', 'fees re-checked at tick — attempting again'),
      });
      summary.fee_released++;
    }

    // 5. Due batches — full, window-elapsed, escalated, or admin-forced.
    const candidates = await items(
      { status: { $in: ['ANCHOR_PENDING', 'ANCHOR_FAILED_RETRYABLE'] } },
      { sort: 'created_date', limit: 50 }, svc);
    const due = candidates.filter((b: any) => {
      if (opts.forceBatchRef && b.batch_ref === opts.forceBatchRef) return true;
      if (b.next_attempt_at && new Date(b.next_attempt_at).getTime() > nowMs) return false;
      const full = (b.member_ids || []).length >= (b.max_size || policy.batchMaxSize);
      const windowDue = b.close_at ? new Date(b.close_at).getTime() <= nowMs : true;
      return full || windowDue || !!b.escalated_at;
    });
    for (const batch of due) {
      try { await attemptBatch(svc, batch, policy, summary, broadcaster); } catch (e) {
        summary.errors.push(`attempt ${batch.batch_ref}: ${String(e?.message || e).slice(0, 120)}`);
      }
    }
  } catch (e) {
    summary.errors.push(`tick: ${String(e?.message || e).slice(0, 200)}`);
  }

  log('tick', { ...summary });

  // Read-only gas-fee monitoring — captures the mainnet eth_gasPrice
  // observation, the live fee-policy decision, hypothetical-ceiling simulation,
  // and the 30-min fee-hold / confirmation-SLA alerts. Runs AFTER production
  // reconciliation so it never delays the tick; every step is non-fatal.
  try { await runGasFeeMonitoring(svc, { batchRef: opts.forceBatchRef || null }); } catch { /* monitoring never blocks the production tick */ }

  return summary;
}

// ── ONE BATCH ATTEMPT ────────────────────────────────────────────────────────
async function attemptBatch(svc: any, batch: any, policy: any, summary: any, broadcaster?: BatchBroadcaster) {
  // Claim — conditional transition so concurrent workers never double-anchor.
  const myClaim = crypto.randomUUID();
  await svc.entities.AnchorBatch.updateMany(
    { id: batch.id, status: { $in: ['ANCHOR_PENDING', 'ANCHOR_FAILED_RETRYABLE'] } },
    { $set: { status: 'ANCHOR_PROCESSING', anchor_claimed_by: myClaim, anchor_claimed_at: nowIso() } },
  );
  const refetched = await svc.entities.AnchorBatch.filter({ id: batch.id }, { limit: 1 });
  const claimed = (refetched?.items || refetched || [])[0];
  if (!claimed || claimed.status !== 'ANCHOR_PROCESSING' || claimed.anchor_claimed_by !== myClaim) return;
  batch = claimed;
  summary.attempted++;
  const credCache = new Map<string, any>();

  const release = async (extra: any = {}) => {
    await svc.entities.AnchorBatch.update(batch.id, { anchor_claimed_by: null, anchor_claimed_at: null, ...extra }).catch(() => {});
  };
  const fail = async (permanent: boolean, reason: string) => {
    log(permanent ? 'permanent_failure' : 'retryable_failure', { batch: batch.batch_ref, reason });
    const attempts = (batch.attempts || 0) + 1;
    const giveUp = permanent || attempts >= policy.maxAttempts;
    const nextAttempt = new Date(Date.now() + backoffSeconds(policy, attempts) * 1000).toISOString();
    await release({
      status: giveUp ? 'ANCHOR_FAILED_PERMANENT' : 'ANCHOR_FAILED_RETRYABLE',
      attempts,
      next_attempt_at: giveUp ? null : nextAttempt,
      last_error: String(reason).slice(0, 300),
      event_log: pushBatchEvent(batch.event_log, giveUp ? 'failed_permanent' : 'retry_scheduled', reason),
    });
    if (giveUp) {
      // The verified credentials are preserved — administrators are alerted,
      // a retry remains possible, nothing is silently dropped.
      for (const memberId of batch.member_ids || []) {
        await svc.entities.Credential.update(memberId, {
          anchor_status: 'failed',
          blockchain: { ...( (credCache.get(memberId) as any) || {} ), status: 'failed', error: String(reason).slice(0, 200), batch_ref: batch.batch_ref },
        }).catch(() => {});
      }
      await notifyAnchorAdmins(svc, 'Anchoring failed permanently',
        `Batch ${batch.batch_ref} (${batch.member_count} credentials) failed permanently: ${reason}. Credentials remain verified and preserved — manual recovery available.`,
        'anchor_escalation', 'urgent');
    }
  };

  // Load members + recompute the BW-HASH-V1 leaves from CURRENT content.
  const memberIds = (batch.member_ids || []).slice(0, batch.max_size || policy.batchMaxSize);
  const remainder = (batch.member_ids || []).slice(memberIds.length);
  const credRows = await svc.entities.Credential.filter({ id: { $in: memberIds } }, { limit: 1000 });
  const members = ((credRows?.items || credRows || []) as any[]).filter((c) => memberIds.includes(c.id));
  if (members.length === 0) {
    await fail(true, 'no_valid_members');
    return;
  }
  // Leaf order = member order. A changed or deleted member is dropped and left
  // to a later batch — never silently anchored with stale content.
  const usable = members.filter((c: any) => c.anchor_status !== 'confirmed');
  const dropped = members.length - usable.length;
  const leaves: string[] = [];
  const leafCreds: any[] = [];
  for (const c of usable) {
    credCache.set(c.id, c.blockchain || {});
    const leaf = await computeCredentialHash({
      verification_id: c.bw_id,
      version: c.hash_version === 2 ? 2 : 1,
      achievement_title: c.title,
      achievement_category: c.category,
      achievement_description: c.description || '',
      date_achieved: c.date_achieved,
    });
    leaves.push(leaf);
    leafCreds.push(c);
  }
  if (leaves.length === 0) { await fail(true, 'no_anchorable_members'); return; }
  if (dropped > 0) log('members_dropped', { batch: batch.batch_ref, dropped });

  // Root + gas policy gate.
  const root = await merkleRoot(leaves);
  const payload = JSON.stringify({ v: 1, t: 'blockward-batch', hv: CREDENTIAL_HASH_VERSION, n: leaves.length, r: root });
  const gasUnits = estimateBatchGas(payload, policy);

  // NETWORK-PINNED (incident §1): the batch's own network field is the
  // authoritative target. The broadcaster (real or mock) receives it so a
  // batch pinned to Amoy can NEVER broadcast on mainnet, regardless of the
  // global issuance selector.
  const batchTarget: TargetNetwork = batch.network === 'polygon_mainnet' ? 'polygon_mainnet' : 'polygon_amoy';
  // SECURITY (incident: synthetic confirmation of AB-5FBCA1): an injected mock
  // broadcaster must NEVER confirm a production Polygon mainnet batch. The mock
  // is test-only; a real mainnet anchor requires the real broadcaster AND an
  // independently verified on-chain receipt. Fail-closed before any broadcast.
  if (broadcaster && batchTarget === 'polygon_mainnet') {
    log('mock_broadcaster_blocked_on_mainnet', { batch: batch.batch_ref });
    await fail(true, 'mock_broadcaster_blocked_on_mainnet');
    return;
  }
  // The broadcaster: production uses the real anchorBatchRoot (network-pinned).
  // A test-injected mock never signs — it is the permanent separation.
  const send: BatchBroadcaster = broadcaster || defaultBroadcaster;

  // Fee gate — PRODUCTION ONLY (broadcaster undefined). A mock broadcaster
  // skips it: no real gas is spent, so the gas-price ceiling cannot block a
  // deterministic test. The mock returns a confirmed result directly.
  let price = { usd: policy.fallbackPolUsd, source: 'fallback_estimate' as string };
  let estimatedFeeWei: string | null = null;
  if (!broadcaster) {
    const cfg = resolvePolygonConfig(batchTarget);
    let maxFeeWei: bigint | null = null;
    try {
      const pub = createPublicClient({ chain: (cfg as any).chain, transport: http(cfg.rpc as string) });
      const gasPrice = await pub.getGasPrice().catch(() => null);
      if (gasPrice) maxFeeWei = (BigInt(gasPrice) * 125n) / 100n; // 25% headroom
      price = await polUsdPrice();
    } catch { /* fall back to ceiling-based gate below */ }
    const gate = feeDecision(gasUnits, maxFeeWei ?? gweiToWeiPerGas(policy.maxFeeGwei), price.usd, policy);
    estimatedFeeWei = String(gate.estFeeWei);

    if (!gate.allowed && !(batch.escalated_at && gate.estUsd <= policy.absoluteMaxCostUsd && gate.reason === 'batch_budget_exceeded')) {
      // ANCHOR_PENDING_FEE — the verified credential is PRESERVED; administrators
      // are notified (deduped) and the batch is retried when fees fall.
      const lastNotify = batch.fee_hold_notified_at ? Date.now() - new Date(batch.fee_hold_notified_at).getTime() : Infinity;
      await release({
        status: 'ANCHOR_PENDING_FEE',
        estimated_fee_wei: estimatedFeeWei,
        next_attempt_at: new Date(Date.now() + 5 * 60000).toISOString(),
        last_error: `fee gate: ${gate.reason} (est. $${gate.estUsd})`,
        fee_hold_notified_at: lastNotify > 6 * 3600 * 1000 ? nowIso() : batch.fee_hold_notified_at,
        event_log: pushBatchEvent(batch.event_log, 'fee_hold', `${gate.reason} — est. $${gate.estUsd} / batch`),
      });
      if (lastNotify > 6 * 3600 * 1000) {
        await notifyAnchorAdmins(svc, 'Anchoring paused by gas policy',
          `Batch ${batch.batch_ref} (${batch.member_count} credentials) is fee-gated: ${gate.reason}, estimated $${gate.estUsd} per batch (budget $${policy.maxBatchCostUsd}). Credentials are safe; anchoring resumes automatically when fees allow.`,
          'anchor_fee_hold', 'normal');
      }
      summary.fee_holds++;
      return;
    }
  }

  // Broadcast — the guards (config, signer, chain-id, zero value, commitment-
  // only payload) all live inside anchorBatchRoot. The batch's pinned network
  // is passed through; a mock never reaches those guards.
  const sent = await send({ rootHex: root, memberCount: leaves.length, target: batchTarget });
  if (!sent.ok) {
    const permanent = ['mainnet_config_missing', 'signer_address_mismatch', 'unsupported_network', 'invalid_root', 'invalid_member_count', 'missing_issuer_key'].includes(sent.error);
    await fail(permanent, sent.error + (sent.missing ? `: ${sent.missing.join(', ')}` : ''));
    return;
  }

  const broadcastAt = nowIso();
  await svc.entities.AnchorBatch.update(batch.id, {
    status: 'ANCHOR_SUBMITTED',
    transaction_hash: sent.transaction_hash,
    attempts: (batch.attempts || 0) + 1,
    estimated_fee_wei: estimatedFeeWei,
    last_error: null,
    anchor_claimed_by: null,
    anchor_claimed_at: null,
    event_log: pushBatchEvent(batch.event_log, 'submitted', `tx ${String(sent.transaction_hash).slice(0, 18)}… (${batch.network}) broadcast_at=${broadcastAt} receipt_pending=${!!sent.receipt_pending}`),
  });
  log('submitted', { batch: batch.batch_ref, tx: sent.transaction_hash, members: leaves.length, receipt_pending: !!sent.receipt_pending });

  // Remainder (an oversized batch) goes to a fresh batch — nothing is lost.
  if (remainder.length > 0) {
    await svc.entities.AnchorBatch.create({
      batch_ref: await generateBatchRef(svc),
      status: 'ANCHOR_PENDING',
      network: batch.network,
      member_ids: remainder,
      member_count: remainder.length,
      max_size: policy.batchMaxSize,
      created_at: nowIso(),
      close_at: batchCloseAt(policy),
      attempts: 0,
      event_log: pushBatchEvent(null, 'opened', `overflow from ${batch.batch_ref} (${batchWindowLabel(policy)})`),
    });
  }

  if (sent.receipt_pending) return; // reconciled on a later tick

  // Receipt already in hand — but VERIFY it independently on-chain before
  // finalizing. A broadcaster's claim (real or mock) is never trusted: the
  // transaction hash must resolve to a genuine, verified receipt.
  const fin = await finalizeBatch(svc, batch, sent.transaction_hash, leaves, leafCreds, root, price, summary);
  if (!fin.confirmed) {
    // The broadcast reported success but the on-chain receipt could not be
    // independently verified (RPC blip, reorg, or integrity failure). The batch
    // stays ANCHOR_SUBMITTED so reconcileSubmitted retries it on the next tick.
    log('finalize_skipped_after_broadcast', { batch: batch.batch_ref, reason: fin.reason });
  }
}

// ── RECONCILIATION ───────────────────────────────────────────────────────────
async function reconcileSubmitted(svc: any, batch: any, policy: any, summary: any) {
  const cfg = resolvePolygonConfig(batch.network === 'polygon_mainnet' ? 'polygon_mainnet' : 'polygon_amoy');
  const pub = createPublicClient({ chain: (cfg as any).chain, transport: http(cfg.rpc as string) });
  const price = await polUsdPrice();
  let receipt: any = null;
  try { receipt = await pub.getTransactionReceipt({ hash: batch.transaction_hash as `0x${string}` }); } catch { receipt = null; }

  if (receipt && receipt.status === 'success') {
    summary.reconciled++;
    const leaves: string[] = [];
    const leafCreds: any[] = [];
    const credRows = await svc.entities.Credential.filter({ id: { $in: batch.member_ids } }, { limit: 1000 });
    for (const c of ((credRows?.items || credRows || []) as any[]).filter((c: any) => (batch.member_ids || []).includes(c.id))) {
      leaves.push(await computeCredentialHash({
        verification_id: c.bw_id, version: c.hash_version === 2 ? 2 : 1,
        achievement_title: c.title, achievement_category: c.category,
        achievement_description: c.description || '', date_achieved: c.date_achieved,
      }));
      leafCreds.push(c);
    }
    const root = await merkleRoot(leaves);
    const fin = await finalizeBatch(svc, batch, batch.transaction_hash, leaves, leafCreds, root, price, summary);
    if (fin.confirmed) return;
    // finalizeBatch's independent on-chain verification failed even though a
    // receipt was fetched — fall through to the retry logic below.
  }

  const submittedAt = batch.event_log?.find?.((e: any) => e.event === 'submitted')?.timestamp || batch.updated_date || batch.created_at;
  const ageMin = submittedAt ? (Date.now() - new Date(submittedAt).getTime()) / 60000 : Infinity;
  if (receipt && receipt.status !== 'success') {
    // Reverted — safe to retry; the root was never committed.
    await svc.entities.AnchorBatch.update(batch.id, {
      status: 'ANCHOR_FAILED_RETRYABLE',
      attempts: (batch.attempts || 0) + 1,
      next_attempt_at: new Date(Date.now() + backoffSeconds(policy, (batch.attempts || 0) + 1) * 1000).toISOString(),
      last_error: 'anchoring transaction reverted',
      event_log: pushBatchEvent(batch.event_log, 'retry_scheduled', 'tx reverted — retrying'),
    }).catch(() => {});
  } else if (ageMin > SUBMIT_RECONCILE_MAX_MINUTES) {
    // Long-missing receipt (RPC outage / evicted tx). Retrying cannot corrupt
    // anything: the commitment is the same root, so a late original tx is an
    // identical, harmless re-anchor.
    await svc.entities.AnchorBatch.update(batch.id, {
      status: 'ANCHOR_FAILED_RETRYABLE',
      attempts: (batch.attempts || 0) + 1,
      next_attempt_at: new Date(Date.now() + backoffSeconds(policy, (batch.attempts || 0) + 1) * 1000).toISOString(),
      last_error: `receipt not found after ${Math.round(ageMin)} min`,
      event_log: pushBatchEvent(batch.event_log, 'retry_scheduled', 'tx receipt not found — retrying'),
    }).catch(() => {});
  }
  // Otherwise: still in flight — leave SUBMITTED for the next tick.
}

// ── FINALIZE ─────────────────────────────────────────────────────────────────
// Receipt verified → proofs computed & verified → per-credential writes →
// achievements VERIFIED → holders notified. Cost accounting recorded.
async function finalizeBatch(svc: any, batch: any, txHash: string, leaves: string[], leafCreds: any[], root: string, price: any, summary: any): Promise<{ confirmed: boolean; reason: string | null }> {
  const target: TargetNetwork = batch.network === 'polygon_mainnet' ? 'polygon_mainnet' : 'polygon_amoy';
  const cfg = resolvePolygonConfig(target);
  const nowIsoStr = nowIso();

  // ── INDEPENDENT ON-CHAIN RECEIPT VERIFICATION (security fix) ──
  // Never trust a broadcaster's claim. Fetch the transaction + receipt from
  // the live Polygon chain and verify chain ID, signer (from/to == expected),
  // zero value, calldata parses as a batch payload whose root === the computed
  // root and memberCount === leaves.length, and block/receipt consistency.
  // A mock, synthetic, reverted or missing transaction returns null and MUST
  // NOT result in ANCHOR_CONFIRMED. This is the gate that prevents AB-5FBCA1.
  const verified = await verifyBatchRootOnChain(target, txHash, root, leaves.length);
  if (!verified) {
    log('finalize_verification_failed', { batch: batch.batch_ref, tx: String(txHash).slice(0, 18) });
    return { confirmed: false, reason: 'receipt_verification_failed' };
  }
  const tx = { transaction_hash: txHash, ...verified };
  const actualFeeWei = tx.effective_gas_price_wei && tx.gas_used
    ? BigInt(tx.effective_gas_price_wei) * BigInt(tx.gas_used) : null;

  const credUpdates: any[] = [];
  const achievementIds = new Set<string>();
  for (let i = 0; i < leafCreds.length; i++) {
    const c = leafCreds[i];
    const proof = await merkleProof(leaves, i);
    const proofOk = await verifyMerkleProof(leaves[i], proof, root); // defence in depth
    if (!proofOk) {
      log('proof_selfcheck_failed', { batch: batch.batch_ref, bw_id: c.bw_id, index: i });
      continue;
    }
    achievementIds.add(c.achievement_id);
    const chainCheck = {
      status: 'confirmed',
      verification_version: BATCH_ANCHOR_VERSION,
      network: cfg.networkName,
      testnet: cfg.isTestnet,
      chain_id: cfg.chainId,
      anchor_mode: 'batch_calldata',
      checked_at: nowIsoStr,
      transaction_hash: tx.transaction_hash,
      batch_root: root,
      batch_member_count: leaves.length,
      merkle_leaf_index: i,
      merkle_leaf: leaves[i],
      recomputed_hash: leaves[i],
      committed_hash: root,
      ...verificationBindings({ ...c, blockchain: { transaction_hash: tx.transaction_hash, chain_id: cfg.chainId, network: cfg.networkName, anchor_mode: 'batch_calldata', contract_address: null } }),
    };
    credUpdates.push({
      id: c.id,
      anchor_status: 'confirmed',
      credential_hash: leaves[i],
      hash_version: CREDENTIAL_HASH_VERSION,
      chain_check: chainCheck,
      blockchain: {
        status: 'confirmed',
        network: cfg.networkName,
        chain_id: cfg.chainId,
        anchor_mode: 'batch_calldata',
        contract_address: null,
        transaction_hash: tx.transaction_hash,
        block_number: tx.block_number ?? null,
        block_timestamp: tx.block_timestamp ?? null,
        batch_ref: batch.batch_ref,
        batch_root: root,
        merkle_leaf_index: i,
        merkle_proof: proof,
        error: null,
      },
    });
  }
  if (credUpdates.length > 0) await svc.entities.Credential.bulkUpdate(credUpdates);

  // Achievements → VERIFIED + holder delivery (same path as direct anchoring).
  // Only real record ids are queried — synthetic/test members (or any member
  // whose achievement row no longer resolves) must not break reconciliation.
  const realAchIds = [...achievementIds].filter((id) => /^[0-9a-f]{24}$/i.test(id));
  if (realAchIds.length > 0) {
    const achRows = await svc.entities.Achievement.filter({ id: { $in: realAchIds } }, { limit: 1000 });
    for (const ach of ((achRows?.items || achRows || []) as any[])) {
      if (ach.status === 'verified') continue;
      await svc.entities.Achievement.update(ach.id, {
        status: 'verified',
        event_log: (ach.event_log || []).concat([{
          event: 'verified', actor: 'system',
          note: `Blockward Verified — Polygon PoS batch anchor confirmed (batch ${batch.batch_ref}, tx ${String(tx.transaction_hash).slice(0, 18)}…)`,
          timestamp: nowIsoStr,
        }]),
      }).catch(() => {});
      try {
        const credRow = credUpdates.find((u) => u.id === (ach.credential_id || ''));
        const bwId = credRow ? ((leafCreds.find((c) => c.id === credRow.id) as any)?.bw_id) : null;
        if (bwId) {
          const mail = holderVerifiedEmail({ achievementTitle: ach.title, bwId, verifyUrl: `${appBaseUrl()}/verify/${bwId}` });
          await sendTrackedEmail(svc, {
            to: ach.holder_email, subject: mail.subject, html: mail.html,
            event_type: 'record_delivered_to_vault', related_id: bwId, retryable: true,
            dedupe_key: `record_delivered_to_vault:${bwId}:batch`,
          });
          await notifyHolder(svc, ach.holder_email, 'Achievement is Blockward Verified',
            `"${ach.title}" is confirmed and secured on the blockchain. Credential ID: ${bwId}.`,
            'achievement_verified', ach.id);
        }
      } catch { /* best-effort delivery */ }
    }
  }

  // Timing instrumentation — compute end-to-end latency from enqueue to receipt.
  const openedAt = batch.created_at || batch.created_date;
  const submittedEvt = (batch.event_log || []).find((e: any) => e.event === 'submitted');
  const broadcastAt = submittedEvt?.timestamp || null;
  const receiptAt = nowIsoStr;
  const totalMs = openedAt ? Math.max(0, new Date(receiptAt).getTime() - new Date(openedAt).getTime()) : null;
  const broadcastMs = broadcastAt ? Math.max(0, new Date(receiptAt).getTime() - new Date(broadcastAt).getTime()) : null;
  await svc.entities.AnchorBatch.update(batch.id, {
    status: 'ANCHOR_CONFIRMED',
    confirmed_at: nowIsoStr,
    merkle_root: root,
    transaction_hash: tx.transaction_hash,
    block_number: tx.block_number ?? null,
    block_timestamp: tx.block_timestamp ?? null,
    actual_fee_wei: actualFeeWei != null ? String(actualFeeWei) : null,
    actual_fee_pol: actualFeeWei != null ? weiToPol(actualFeeWei) : null,
    actual_cost_usd: actualFeeWei != null ? weiToUsd(actualFeeWei, price.usd) : null,
    price_source: price.source,
    anchor_claimed_by: null,
    anchor_claimed_at: null,
    last_error: null,
    event_log: pushBatchEvent(batch.event_log, 'confirmed', `${leaves.length} credentials anchored — tx ${String(tx.transaction_hash).slice(0, 18)}…, fee ${actualFeeWei != null ? weiToPol(actualFeeWei) : 'n/a'} POL, total=${totalMs}ms broadcast_to_receipt=${broadcastMs}ms`),
  });
  summary.confirmed += credUpdates.length;
  log('confirmed', { batch: batch.batch_ref, members: leaves.length, tx: tx.transaction_hash, total_ms: totalMs, broadcast_to_receipt_ms: broadcastMs });
  return { confirmed: true, reason: null };
}