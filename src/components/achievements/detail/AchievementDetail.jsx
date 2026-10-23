import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Share2, ExternalLink, Loader2, ArrowUpRight, Check, AlertTriangle,
  ImagePlus, MoreHorizontal, Download, PenTool,
} from 'lucide-react';
import VerificationTimeline from '@/components/achievements/VerificationTimeline';
import ShareCredentialDialog from '@/components/achievements/ShareCredentialDialog';
import EvidencePreview from '@/components/evidence/EvidencePreview';
import DefaultBannerCover from '@/components/achievements/banner/DefaultBannerCover';
import { downloadCertificatePDF } from '@/lib/portfolioPdf';
import { resolveStatus, formatDate, formatDateTime } from '@/lib/achievementStatus';

function SummaryField({ label, value, mono }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-tertiary">{label}</p>
      <p className={cn('mt-0.5 truncate text-sm font-medium text-foreground', mono && 'font-mono text-xs')}>{value || '—'}</p>
    </div>
  );
}

/**
 * AchievementDetail — the redesigned, professional credential presentation:
 * a banner hero with the owner's Edit-cover action, a clean credential
 * summary, grouped actions, and Overview / Verification / Evidence / Activity
 * tabs. Presentation only — verification state, integrity and blockchain data
 * are rendered exactly as stored.
 */
export default function AchievementDetail({ item, bannerUrl, open, onOpenChange, onEditCover, onResend, onRetry, retrying, onVisibility, visibilityBusy = false, profile }) {
  const [shareOpen, setShareOpen] = useState(false);
  if (!item) return null;
  const a = item;
  const c = a.credential;
  const r = a.request;
  const status = resolveStatus(a);
  const verified = status.key === 'blockward_verified';
  const bc = c?.blockchain || {};
  const verifiers = c?.verifiers || [];
  const holderName = a.holder_name || c?.holder_display_name || '—';
  const explorerUrl = bc.transaction_hash
    ? `https://${(bc.chain_id === 137 || bc.network === 'polygon') ? '' : 'amoy.'}polygonscan.com/tx/${bc.transaction_hash}`
    : null;
  const bcNetworkLabel = (bc.chain_id === 137 || bc.network === 'polygon' || bc.network === 'polygon_mainnet')
    ? 'Polygon Mainnet'
    : ((bc.network || '').includes('amoy') || bc.chain_id === 80002)
      ? 'Polygon Amoy — Testnet'
      : 'Polygon';
  const verifierNames = verifiers.map((v) => v.name).filter(Boolean).join(', ');
  const verifiedOn = c?.verified_at || r?.responded_at;

  const certificate = () => downloadCertificatePDF({
    title: a.title,
    category: a.category,
    date_achieved: a.date_achieved,
    description: a.description,
    verify_id: c?.bw_id || null,
  }, profile);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-w-4xl flex-col gap-0 overflow-hidden p-0 max-h-[92vh]">
          <DialogTitle className="sr-only">{item.title} — achievement detail</DialogTitle>
          {/* ── Banner hero ── */}
          <div className="relative aspect-video max-h-[280px] w-full flex-shrink-0 overflow-hidden bg-secondary">
            {bannerUrl ? (
              <img src={bannerUrl} alt={a.title} className="h-full w-full object-cover" />
            ) : (
              <DefaultBannerCover fallback={a.category} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" aria-hidden="true" />

            <button
              type="button"
              onClick={() => onEditCover?.(a)}
              className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/70"
            >
              <ImagePlus className="h-3.5 w-3.5" /> {bannerUrl ? 'Edit cover' : 'Add cover'}
            </button>

            <div className="absolute inset-x-0 bottom-0 p-5">
              <span className={cn('mb-2 inline-block rounded-md border px-2 py-0.5 text-xs font-medium backdrop-blur-sm', status.cls)}>
                {status.label}
              </span>
              <h2 className="text-xl font-semibold leading-tight text-white sm:text-2xl">{a.title}</h2>
              <p className="mt-1 text-sm text-white/80">
                {[a.issuer_org || c?.issuer_org, formatDate(a.date_achieved)].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
            {/* Credential summary */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-border py-4 sm:grid-cols-3">
              <SummaryField label="Awarded to" value={holderName} />
              <SummaryField label="Issued by" value={c?.issuer_org || a.issuer_org} />
              <SummaryField label="Date awarded" value={formatDate(a.date_achieved)} />
              <SummaryField label="Credential ID" value={c?.bw_id} mono />
              <SummaryField label="Authorised verifier" value={verifierNames} />
              <SummaryField label="Date verified" value={verifiedOn ? formatDateTime(verifiedOn) : null} />
            </dl>

            {/* ── Actions — grouped, one row ── */}
            <div className="flex flex-wrap items-center gap-2 py-4">
              {verified && (
                <Button size="sm" onClick={() => setShareOpen(true)}><Share2 className="h-4 w-4" /> Share credential</Button>
              )}
              {c?.bw_id && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`/verify/${c.bw_id}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Public verification page</a>
                </Button>
              )}
              {c?.bw_id && (
                <Button size="sm" variant="outline" onClick={certificate}><Download className="h-4 w-4" /> Download certificate</Button>
              )}
              {!verified && ['draft', 'could_not_verify'].includes(status.key) && (
                <Button size="sm" onClick={() => onResend?.(a)}><PenTool className="h-4 w-4" /> Request verification</Button>
              )}
              {!verified && ['awaiting_issuer', 'awaiting_signature', 'issuer_verified'].includes(status.key) && (
                <Button size="sm" variant="outline" onClick={() => onResend?.(a)}><PenTool className="h-4 w-4" /> Resend request</Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /> More options</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={() => onVisibility?.(a.is_public === false)} disabled={visibilityBusy}>
                    {visibilityBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {a.is_public === false ? 'Make public' : 'Make private'}
                  </DropdownMenuItem>
                  {c?.anchor_status === 'failed' && (
                    <DropdownMenuItem onClick={() => onRetry?.(a)}>
                      {retrying === a.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowUpRight className="h-4 w-4 mr-2" />} Retry blockchain confirmation
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* ── Tabs ── */}
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="verification">Verification</TabsTrigger>
                <TabsTrigger value="evidence">Evidence</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-tertiary">Achievement</h4>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {a.description || <span className="text-muted-foreground">No description provided.</span>}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <SummaryField label="Category" value={(a.category || '').replace(/_/g, ' ')} />
                  {a.expires_at && <SummaryField label="Expires" value={formatDate(a.expires_at)} />}
                  {a.issuer_website && <SummaryField label="Organisation website" value={a.issuer_website} />}
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{a.is_public === false ? 'Private' : 'Public'}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.is_public === false
                        ? 'Hidden from your public profile and portfolio endpoints.'
                        : 'Shown on your public profile and shareable portfolio.'}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onVisibility?.(a.is_public === false)} disabled={visibilityBusy}>
                    {visibilityBusy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    {a.is_public === false ? 'Make public' : 'Make private'}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="verification" className="mt-4 space-y-4">
                <div className="rounded-xl border border-border px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{status.label}</p>
                  {status.detail && <p className="mt-0.5 text-xs text-muted-foreground">{status.detail}</p>}
                </div>

                {(r?.decision_method || verifiedOn) && (
                  <div className="rounded-xl border border-border px-4 divide-y divide-border/60">
                    {r?.decision_method && (
                      <div className="py-2.5"><SummaryField label="Verification method" value={r.decision_method.replace(/_/g, ' ')} /></div>
                    )}
                    {verifiedOn && (
                      <div className="py-2.5"><SummaryField label="Verified on" value={formatDateTime(verifiedOn)} /></div>
                    )}
                  </div>
                )}

                {verifiers.length > 0 && (
                  <div className="rounded-xl border border-border p-4">
                    <p className="mb-2 text-xs uppercase tracking-wider text-tertiary">Authorised verifier{verifiers.length > 1 ? 's' : ''}</p>
                    <div className="space-y-1.5">
                      {verifiers.map((v, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-success/30 bg-success/15"><Check className="h-3 w-3 text-success" /></span>
                          <span className="font-medium text-foreground">{v.name}</span>
                          {v.title && <span className="text-tertiary">· {v.title}</span>}
                          {v.signed_at && <span className="ml-auto text-xs text-tertiary">{formatDate(v.signed_at)}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {r && (r.required_signatures || 1) > 1 && r.status !== 'approved' && (
                  <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {r.signature_count || 0} of {r.required_signatures} required signatures complete
                  </div>
                )}
                {r?.status === 'rejected' && (
                  <p className="text-xs text-destructive">The issuer could not verify this{r.decision_reason ? ` — "${r.decision_reason}"` : ''}.</p>
                )}

                {c && (
                  <div className="rounded-xl border border-border px-4 divide-y divide-border/60">
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <SummaryField label="Blockchain network" value={bcNetworkLabel} />
                      <SummaryField label="Integrity" value={
                        verified ? 'Integrity confirmed' : bc.transaction_hash ? 'Verification required' : 'Pending'
                      } />
                    </div>
                    <div className="py-2.5"><SummaryField label="Credential commitment" value={c.credential_hash} mono /></div>
                    {bc.transaction_hash && <div className="py-2.5"><SummaryField label="Transaction" value={bc.transaction_hash} mono /></div>}
                    {bc.block_number && (
                      <div className="py-2.5 flex items-center justify-between gap-3">
                        <SummaryField label="Block" value={String(bc.block_number)} mono />
                        {bc.block_timestamp && <SummaryField label="Block timestamp" value={formatDateTime(bc.block_timestamp)} />}
                      </div>
                    )}
                  </div>
                )}
                {explorerUrl && (
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    View transaction on PolygonScan <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}
                {c?.anchor_status === 'failed' && (
                  <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                    <span className="text-xs text-destructive">Blockchain confirmation delayed</span>
                    <Button size="sm" variant="outline" onClick={() => onRetry?.(a)} disabled={retrying === a.id}>
                      {retrying === a.id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Retry
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="evidence" className="mt-4">
                {(() => {
                  const evidence = [
                    ...(a.evidence || []),
                    ...(a.certificate_url ? [{ name: a.certificate_name || 'Certificate', url: a.certificate_url }] : []),
                  ].filter((e) => e && e.url);
                  if (!evidence.length) {
                    return <p className="py-6 text-center text-sm text-muted-foreground">No evidence attached. Evidence is the original documentation the issuer reviewed.</p>;
                  }
                  return (
                    <div className="space-y-2">
                      <div className="rounded-xl border border-border p-3">
                        <EvidencePreview items={evidence} context={{ achievementId: a.id }} emptyText="No evidence attached." />
                      </div>
                      <p className="text-[11px] text-tertiary">
                        Original supporting documentation. Your cover image is separate decorative
                        presentation and is never treated as evidence.
                      </p>
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <div className="rounded-xl border border-border p-4">
                  <VerificationTimeline item={a} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <ShareCredentialDialog open={shareOpen} onOpenChange={setShareOpen} credential={c} />
    </>
  );
}