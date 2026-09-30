import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PenTool, Share2, ExternalLink, Loader2, ArrowUpRight, Check, AlertTriangle } from 'lucide-react';
import { BlockwardMark } from '@/components/brand/BlockwardLogo';
import BlockwardVerifiedCredential from './BlockwardVerifiedCredential';
import VerificationTimeline from './VerificationTimeline';
import ShareCredentialDialog from './ShareCredentialDialog';
import { resolveStatus, formatDate, formatDateTime } from '@/lib/achievementStatus';

function Section({ title, children, right }) {
  return (
    <section className="mt-5">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs uppercase tracking-wider text-tertiary font-semibold">{title}</h4>
        {right}
      </div>
      {children}
    </section>
  );
}
function Field({ label, value, mono }) {
  return (
    <div className="py-2 border-b border-border/60 last:border-0">
      <p className="text-xs text-tertiary">{label}</p>
      <p className={cn('text-sm text-foreground break-all', mono && 'font-mono text-xs')}>{value || '—'}</p>
    </div>
  );
}

/**
 * Rich achievement detail drawer. Hierarchy: ACHIEVEMENT → ISSUER → STATUS,
 * then Issuer Verification, Blockchain Integrity, and a provenance Timeline
 * built only from real audit data. Verified achievements render the premium
 * Blockward Verified credential card.
 */
export default function AchievementDetailDrawer({ item, open, onOpenChange, onResend, onRetry, retrying }) {
  const [shareOpen, setShareOpen] = useState(false);
  if (!item) return null;
  const a = item;
  const c = a.credential;
  const r = a.request;
  const status = resolveStatus(a);
  const verified = status.key === 'blockward_verified';
  const bc = c?.blockchain || {};
  const verifiers = c?.verifiers || [];
  const explorerUrl = bc.transaction_hash ? `https://amoy.polygonscan.com/tx/${bc.transaction_hash}` : null;
  const integrity = c?.chain_check || {};

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <BlockwardMark className="h-5 w-5" />
              <DialogTitle className="text-base">Achievement detail</DialogTitle>
            </div>
          </DialogHeader>

          {/* Verified credential card */}
          {verified && (
            <div className="space-y-3">
              <BlockwardVerifiedCredential item={a} />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShareOpen(true)}><Share2 className="h-4 w-4 mr-2" /> Share credential</Button>
                {c?.bw_id && (
                  <Button variant="outline" asChild><a href={`/verify/${c.bw_id}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" /> Public page</a></Button>
                )}
              </div>
            </div>
          )}

          {/* Header for non-verified */}
          {!verified && (
            <div className="surface-card rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-foreground">{a.title}</h2>
                <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium', status.cls)}>{status.label}</span>
              </div>
              {status.detail && <p className="text-xs text-muted-foreground">{status.detail}</p>}
              <p className="text-xs text-tertiary mt-1 capitalize">{(a.category || '').replace(/_/g, ' ')} · {formatDate(a.date_achieved)}</p>
              {a.description && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{a.description}</p>}
            </div>
          )}

          {/* Issuer Verification */}
          <Section title="Issuer verification">
            <div className="surface-card rounded-xl px-4 divide-y divide-border/60">
              <Field label="Issuing organisation" value={c?.issuer_org || a.issuer_org} />
              {a.issuer_website && <Field label="Organisation website" value={a.issuer_website} />}
              {r?.decision_method && <Field label="Verification method" value={r.decision_method.replace(/_/g, ' ')} />}
              {(c?.verified_at || r?.responded_at) && <Field label="Verified on" value={formatDateTime(c?.verified_at || r?.responded_at)} />}
            </div>

            {/* Signatures */}
            {verifiers.length > 0 && (
              <div className="mt-2 surface-card rounded-xl p-4">
                <p className="text-xs text-tertiary mb-2">Authorised verifier{verifiers.length > 1 ? 's' : ''}</p>
                <div className="space-y-1.5">
                  {verifiers.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="h-5 w-5 rounded-full bg-success/15 border border-success/30 flex items-center justify-center"><Check className="h-3 w-3 text-success" /></span>
                      <span className="text-foreground font-medium">{v.name}</span>
                      {v.title && <span className="text-tertiary">· {v.title}</span>}
                      {v.signed_at && <span className="text-tertiary text-xs ml-auto">{formatDate(v.signed_at)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {r && (r.required_signatures || 1) > 1 && r.status !== 'approved' && (
              <div className="mt-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                {r.signature_count || 0} of {r.required_signatures} required signatures complete
              </div>
            )}
            {r?.status === 'rejected' && (
              <p className="mt-2 text-xs text-destructive">The issuer could not verify this{r.decision_reason ? ` — "${r.decision_reason}"` : ''}.</p>
            )}
          </Section>

          {/* Blockchain Integrity */}
          {c && (
            <Section title="Blockchain integrity" right={<span className="text-xs text-tertiary">Polygon Amoy — Testnet</span>}>
              <div className="surface-card rounded-xl px-4 divide-y divide-border/60">
                <Field label="Status" value={integrity.status === 'confirmed' ? 'Integrity confirmed' : bc.transaction_hash ? 'Anchor confirmed' : 'Pending'} />
                <Field label="Credential commitment" value={c.credential_hash} mono />
                {bc.transaction_hash && <Field label="Transaction" value={bc.transaction_hash} mono />}
                {bc.block_number && <Field label="Block" value={String(bc.block_number)} mono />}
                {bc.block_timestamp && <Field label="Blockchain timestamp" value={formatDateTime(bc.block_timestamp)} />}
              </div>
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  View transaction on PolygonScan <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
              {c.anchor_status === 'failed' && (
                <div className="mt-2 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <span className="text-xs text-destructive">Blockchain confirmation delayed</span>
                  <Button size="sm" variant="outline" onClick={() => onRetry?.(a)} disabled={retrying === a.id}>
                    {retrying === a.id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Retry
                  </Button>
                </div>
              )}
            </Section>
          )}

          {/* Timeline */}
          <Section title="Verification timeline">
            <div className="surface-card rounded-xl p-4">
              <VerificationTimeline item={a} />
            </div>
          </Section>

          {/* Actions */}
          {!verified && (
            <div className="mt-5 flex flex-wrap gap-2">
              {['draft', 'could_not_verify'].includes(status.key) && (
                <Button onClick={() => onResend?.(a)}><PenTool className="h-4 w-4 mr-2" /> Request verification</Button>
              )}
              {['awaiting_issuer', 'awaiting_signature', 'issuer_verified'].includes(status.key) && (
                <Button variant="outline" onClick={() => onResend?.(a)}><PenTool className="h-4 w-4 mr-2" /> Resend request</Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ShareCredentialDialog open={shareOpen} onOpenChange={setShareOpen} credential={c} />
    </>
  );
}