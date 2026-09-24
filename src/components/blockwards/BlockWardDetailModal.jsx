import React from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import {
  Calendar, User, Award, ExternalLink, FileText, ShieldCheck, Link2,
  UserCheck, Ban, History, PenLine, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * BlockWardDetailModal — the private vault detail view for ONE achievement.
 * Shows the full picture the student owns: evidence, verification status
 * (organisation / independent / revoked / superseded), the on-chain anchor
 * state, the signer chain (approval history) and a live-verify link.
 * All fields are optional so legacy BlockWard objects still render.
 */

const VERIFICATION_LABEL = {
  organisation: { label: 'Verified by organisation', Icon: BadgeCheck, cls: 'bg-success/10 text-success border-success/30' },
  independent: { label: 'Independently verified', Icon: UserCheck, cls: 'bg-info/10 text-info border-info/30' },
  revoked: { label: 'Revoked', Icon: Ban, cls: 'bg-destructive/10 text-destructive border-destructive/30' },
  superseded: { label: 'Superseded — newer version', Icon: History, cls: 'bg-warning/10 text-warning border-warning/30' },
};

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
      <Icon className="h-5 w-5 text-primary flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium text-foreground break-words">{children}</div>
      </div>
    </div>
  );
}

const METHOD_LABEL = {
  witnessed_in_person: 'Witnessed in person',
  reviewed_evidence: 'Reviewed the evidence',
  official_records: 'Checked official records',
  third_party: 'Confirmed with a third party',
  other: 'Other method',
};

export default function BlockWardDetailModal({ blockWard, open, onClose, onEdit }) {
  if (!blockWard) return null;

  const status = blockWard.status && VERIFICATION_LABEL[blockWard.status]
    ? blockWard.status
    : blockWard.verification_mode === 'independent' ? 'independent' : 'organisation';
  const ver = VERIFICATION_LABEL[status] || VERIFICATION_LABEL.organisation;
  const chainConfirmed = blockWard.chain_confirmed === true || !!blockWard.token_id;
  const verifyId = blockWard.verify_id || blockWard.verification_id || null;
  const signerChain = blockWard.signer_chain || [];
  const iv = blockWard.independent_verifier || null;
  const imageUrl = blockWard.image_url && !blockWard.image_url.includes('dicebear') ? blockWard.image_url : null;
  const issuedBy = blockWard.issuer_name || blockWard.issuedBy || blockWard.admin_name || blockWard.teacher_name;
  const issuedAt = blockWard.minted_at || blockWard.issuedAt || blockWard.vault_delivered_at;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Achievement details</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Verification status — the headline, never just the title */}
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${ver.cls}`}>
            <ver.Icon className="h-3.5 w-3.5" /> {ver.label}
          </div>

          {/* Card preview */}
          <div
            className={`h-36 rounded-xl p-5 flex flex-col justify-end relative overflow-hidden ${!imageUrl ? 'bg-gradient-to-br from-violet-500 to-indigo-600' : ''}`}
            style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
          >
            {imageUrl && <div className="absolute inset-0 bg-black/50" />}
            <h3 className="relative z-10 text-white font-bold text-xl drop-shadow-md leading-snug">{blockWard.title}</h3>
          </div>

          {blockWard.description && (
            <p className="text-sm text-muted-foreground">{blockWard.description}</p>
          )}

          {/* On-chain state — only ever "confirmed" with an anchor present */}
          <div className={`flex items-center gap-3 p-3 rounded-lg border ${chainConfirmed ? 'border-success/30 bg-success/5' : 'border-border bg-secondary/50'}`}>
            {chainConfirmed ? <ShieldCheck className="h-5 w-5 text-success" /> : <Link2 className="h-5 w-5 text-muted-foreground" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {chainConfirmed ? 'Blockchain-confirmed' : 'Anchor pending'}
              </p>
              <p className="text-xs text-muted-foreground">
                {chainConfirmed
                  ? `Recorded on Sepolia (testnet)${blockWard.token_id ? ` — record #${blockWard.token_id}` : ''}`
                  : 'This credential has not been anchored on-chain yet.'}
              </p>
            </div>
            {blockWard.transaction_hash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${blockWard.transaction_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                aria-label="View transaction on Etherscan"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2">
            <Row icon={Award} label="Category">{blockWard.category || '—'}</Row>
            {iv && (
              <Row icon={User} label="Independently verified by">
                {[iv.name, iv.role, iv.organisation_label].filter(Boolean).join(' · ')}
              </Row>
            )}
            {issuedBy && !iv && (
              <Row icon={User} label="Authorised by">{issuedBy}</Row>
            )}
            {issuedAt && (
              <Row icon={Calendar} label="Earned on">
                {format(new Date(issuedAt), 'MMMM d, yyyy')}
              </Row>
            )}
            {blockWard.file_url && (
              <Row icon={FileText} label="Evidence">
                <a href={blockWard.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  View evidence file
                </a>
              </Row>
            )}
            {blockWard.corrected_at && (
              <Row icon={History} label="Correction">
                Corrected on {format(new Date(blockWard.corrected_at), 'MMMM d, yyyy')}
                {blockWard.version ? ` — version ${blockWard.version}` : ''}
              </Row>
            )}
          </div>

          {/* Approval history — the signer chain, most recent first */}
          {signerChain.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Approval history</h4>
              <ol className="space-y-2">
                {signerChain.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 rounded-lg border border-border bg-background p-2.5">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {s.name || 'Signer'} <span className="text-muted-foreground font-normal">— {s.role}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[METHOD_LABEL[s.method] || 'Attested', s.timestamp && format(new Date(s.timestamp), 'd MMM yyyy, HH:mm')].filter(Boolean).join(' · ')}
                      </p>
                      {s.method_note && <p className="text-xs text-muted-foreground mt-0.5 italic">{s.method_note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {verifyId && (
              <Button asChild variant="outline" className="w-full">
                <Link to={`/verify/${verifyId}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> Open live verification page
                </Link>
              </Button>
            )}
            {onEdit && (
              <Button variant="outline" className="w-full" onClick={onEdit}>
                <PenLine className="h-4 w-4 mr-2" /> Edit
              </Button>
            )}
          </div>

          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-xs text-muted-foreground">
              🔒 This achievement is permanently tied to you. It cannot be transferred or given away.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}