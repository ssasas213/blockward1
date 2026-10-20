import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import BrandHeader from '@/components/public/BrandHeader';
import {
  Shield, ShieldCheck, CheckCircle2, AlertCircle, Clock, ExternalLink,
  Hash, Network, Layers, Copy, Building2, Calendar, UserCheck, Loader2, ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Verify from './Verify';

// Public verification for Blockward credentials stored in the credential
// registry (issuer-verified + Polygon-anchored, incl. BATCH-PROOF-V1 Merkle
// batches). Legacy registry credentials fall through to the original
// verification page — both systems stay fully verifiable on one URL.

const INTEGRITY_COPY = {
  confirmed: {
    tone: 'ok', icon: ShieldCheck, title: 'Integrity confirmed',
    body: 'The displayed details were independently recalculated and match the commitment anchored on-chain. This credential has not been altered since it was anchored.',
  },
  hash_mismatch: {
    tone: 'bad', icon: AlertCircle, title: 'Integrity failed',
    body: 'The displayed details do NOT match the commitment anchored on-chain. Do not trust this credential in its current form.',
  },
  anchor_invalid: {
    tone: 'warn', icon: AlertCircle, title: 'Anchor could not be validated',
    body: 'The on-chain anchor exists but could not be validated against this credential. No confirmed claim is shown.',
  },
  chain_unavailable: {
    tone: 'warn', icon: Clock, title: 'Blockchain temporarily unreachable',
    body: 'The on-chain commitment could not be re-checked just now. No confirmed claim is shown until it can.',
  },
  pending: {
    tone: 'warn', icon: Clock, title: 'Commitment pending',
    body: 'The on-chain commitment for this credential is still being created. Once anchored, its integrity can be re-checked here at any time.',
  },
};

const TRUST_LEVEL_COPY = {
  blockward_verified: 'Blockward Verified',
  person_verified: 'Person verified',
  organisation_only: 'Organisation verified',
  unverified: 'Unverified',
};

function Row({ icon: Icon, label, value, mono, truncate }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5 border border-border">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-tertiary uppercase tracking-wide">{label}</p>
        <p className={cn('text-sm font-medium text-foreground break-words mt-0.5', mono && 'font-mono text-xs', truncate && 'truncate')} title={mono ? value : undefined}>{value}</p>
      </div>
    </div>
  );
}

function NewCredentialView({ data }) {
  const [copied, setCopied] = useState(false);
  const { trust, credential: cred, blockchain, integrity } = data;
  const ic = INTEGRITY_COPY[integrity?.status] || INTEGRITY_COPY.pending;
  const IntegrityIcon = ic.icon;
  const networkKey = (blockchain?.network || '').toLowerCase();
  const networkLabel = networkKey === 'polygon'
    ? 'Polygon PoS (mainnet)'
    : networkKey.includes('amoy')
      ? 'Polygon Amoy (testnet)'
      : blockchain?.network || 'Polygon';
  const batch = blockchain?.batch || null;
  const proof = Array.isArray(batch?.merkle_proof) ? batch.merkle_proof : null;

  const copyId = () => {
    navigator.clipboard.writeText(cred.bw_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <BrandHeader />
      <div className="max-w-2xl mx-auto px-4 py-10 md:py-14 animate-fade-in accent-glow">
        {/* Credential ID + integrity headline */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 border',
              ic.tone === 'ok' ? 'bg-success/10 border-success/30' : ic.tone === 'bad' ? 'bg-destructive/10 border-destructive/30' : 'bg-warning/10 border-warning/30',
            )}>
              <IntegrityIcon className={cn('h-6 w-6', ic.tone === 'ok' ? 'text-success' : ic.tone === 'bad' ? 'text-destructive' : 'text-warning')} />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-sm text-foreground truncate">{cred.bw_id}</p>
              <p className="text-xs text-tertiary">Blockward Credential</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={copyId} className="flex-shrink-0">
            <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy ID'}
          </Button>
        </div>

        {/* Integrity banner — the headline claim, gated on the live on-chain check */}
        <div className={cn(
          'rounded-2xl border p-5 mb-6 flex items-start gap-4',
          ic.tone === 'ok' ? 'border-success/30 bg-success/5' : ic.tone === 'bad' ? 'border-destructive/30 bg-destructive/5' : 'border-warning/30 bg-warning/5',
        )}>
          <div className="min-w-0">
            <p className={cn('font-semibold', ic.tone === 'ok' ? 'text-success' : ic.tone === 'bad' ? 'text-destructive' : 'text-warning')}>{ic.title}</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{ic.body}</p>
            {integrity?.checked_at && (
              <p className="text-xs text-tertiary mt-2">Last checked {format(new Date(integrity.checked_at), 'PPP p')}</p>
            )}
          </div>
        </div>

        {/* Credential */}
        <Card className="surface-card mb-6">
          <CardContent className="p-6">
            <p className="text-[11px] font-medium text-tertiary uppercase tracking-wide mb-1">Achievement</p>
            <h1 className="font-display text-2xl tracking-tight text-foreground leading-snug">{cred.title}</h1>
            {cred.description && <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{cred.description}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mt-4">
              <Row icon={UserCheck} label="Holder" value={cred.holder_display_name} />
              <Row icon={Building2} label="Issued by" value={
                cred.issuer_org ? (cred.issuer_website ? (
                  <a href={cred.issuer_website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{cred.issuer_org}</a>
                ) : cred.issuer_org) : null} />
              <Row icon={Calendar} label="Date achieved" value={cred.date_achieved} />
              <Row icon={CheckCircle2} label="Verified on" value={cred.verified_at ? format(new Date(cred.verified_at), 'PPP') : null} />
              <Row icon={Shield} label="Verification method" value={cred.verification_method_label} />
              <Row icon={Hash} label="Validity" value={cred.validity === 'valid' ? 'Valid' : cred.validity === 'expired' ? 'Expired' : cred.validity === 'revoked' ? 'Revoked' : 'Expiring soon'} />
            </div>
          </CardContent>
        </Card>

        {/* Trust layers */}
        <Card className="surface-card mb-6">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Trust layers
            </h2>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border bg-primary/10 border-primary/30 text-primary">
                <ShieldCheck className="h-3.5 w-3.5" /> {TRUST_LEVEL_COPY[trust?.trust_level] || 'Unverified'}
              </span>
              {trust?.organisation?.status === 'verified' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border bg-success/10 border-success/30 text-success">
                  <Building2 className="h-3.5 w-3.5" /> {trust.organisation.name} is Blockward Verified
                </span>
              )}
            </div>
            {(trust?.verifiers || []).length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] font-medium text-tertiary uppercase tracking-wide mb-2">Signed by</p>
                <div className="space-y-1.5">
                  {(trust.verifiers || []).map((v, i) => (
                    <p key={i} className="text-sm text-foreground">
                      {v.name}{v.title ? <span className="text-muted-foreground"> · {v.title}</span> : null}
                      {v.signed_at ? <span className="text-tertiary text-xs"> · {format(new Date(v.signed_at), 'PPP')}</span> : null}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {(trust?.reasons || []).length > 0 && integrity?.status !== 'confirmed' && (
              <ul className="mt-3 space-y-1 border-t border-border pt-3">
                {(trust.reasons || []).map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-center gap-2"><AlertCircle className="h-3 w-3 text-warning flex-shrink-0" /> {r}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Technical details — network, transaction, batch + Merkle proof */}
        <Collapsible className="rounded-xl border border-border surface-card">
          <CollapsibleTrigger className="group w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-hover/40 transition-colors">
            <div>
              <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider flex items-center gap-2">
                <Network className="h-4 w-4" /> Technical details
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Blockchain network, transaction anchor, Merkle batch and content commitment (SHA-256)
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-tertiary flex-shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-5 pb-5 border-t border-border pt-4">
            <Row icon={Network} label="Network" value={<span>{networkLabel}{blockchain?.testnet ? <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warning/10 border border-warning/30 text-warning">TESTNET</span> : null}</span>} />
            {blockchain?.transaction_hash && (
              <>
                <Row icon={Hash} label="Transaction hash" value={blockchain.transaction_hash} mono />
                <a href={blockchain.explorer_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mb-2">
                  <ExternalLink className="h-3 w-3" /> View transaction on PolygonScan
                </a>
              </>
            )}
            {blockchain?.block_number != null && <Row icon={Layers} label="Block" value={`#${blockchain.block_number}`} mono />}
            {blockchain?.anchor_mode && <Row icon={Layers} label="Anchor mode" value={blockchain.anchor_mode === 'batch_calldata' ? 'Merkle batch (BATCH-PROOF-V1)' : 'Direct commitment'} />}
            {integrity?.committed_hash && <Row icon={Hash} label="Content commitment (SHA-256)" value={integrity.committed_hash} mono />}

            {batch && (
              <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-[11px] font-semibold text-tertiary uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5" /> Merkle batch anchor
                </p>
                <Row icon={Hash} label="Batch ID" value={batch.batch_ref} mono />
                {batch.batch_root && <Row icon={Hash} label="Batch Merkle root (committed on-chain)" value={batch.batch_root} mono />}
                {batch.batch_member_count != null && <Row icon={Layers} label="Credentials in this batch" value={String(batch.batch_member_count)} />}
                {batch.merkle_leaf_index != null && <Row icon={Hash} label="This credential's leaf index" value={`#${batch.merkle_leaf_index}`} mono />}
                {proof && (
                  <div className="mt-2">
                    <p className="text-[11px] font-medium text-tertiary uppercase tracking-wide mb-1">Inclusion proof ({proof.length} steps)</p>
                    <div className="rounded-lg bg-background/60 border border-border p-3 font-mono text-[11px] text-muted-foreground space-y-1 break-all">
                      {proof.map((s, i) => (
                        <p key={i} className="break-all">
                          <span className={s.position === 'left' ? 'text-primary' : 'text-accent'}>{s.position === 'left' ? '◀ left ' : '▶ right'}</span>{' '}
                          {String(s.hash).replace(/^0x/, '')}
                        </p>
                      ))}
                      <p className="text-[10px] text-tertiary pt-1">Anyone can recombine these sibling hashes with the credential's commitment and check the result equals the batch root above — no Blockward account or trust required.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        <p className="mt-8 text-center text-xs text-tertiary leading-relaxed">
          This check ran live against the blockchain — anyone can repeat it at any time.
          Anchoring proves a commitment of record existed at a point in time; it is not a judgement about the achievement itself.
        </p>
      </div>
    </div>
  );
}

export default function CredentialVerify() {
  const routeParams = useParams();
  const verificationId = routeParams.verification_id || new URLSearchParams(window.location.search).get('id');
  const [mode, setMode] = useState(verificationId ? 'checking' : 'legacy');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!verificationId) return;
    let cancelled = false;
    base44.functions.invoke('publicVerifyData', { bw_id: verificationId })
      .then((res) => {
        if (cancelled) return;
        if (res.data?.found) { setResult(res.data); setMode('credential'); }
        else setMode('legacy');
      })
      .catch(() => { if (!cancelled) setMode('legacy'); });
    return () => { cancelled = true; };
  }, [verificationId]);

  if (mode === 'checking' || !verificationId) {
    if (mode === 'checking') {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      );
    }
  }
  if (mode !== 'credential') return <Verify />;
  return <NewCredentialView data={result} />;
}