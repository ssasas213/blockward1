import React, { useState } from 'react';
import { BadgeCheck, PenLine, ShieldCheck, HardDrive, ExternalLink, FileText, Quote, Pin, Share2 } from 'lucide-react';
import AchievementShareDialog from '@/components/publicProfile/AchievementShareDialog';
import { Button } from '@/components/ui/button';
import EndorsementList from '@/components/endorsements/EndorsementList';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const fmt = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * AchievementDetailModal — full credential detail shown when a tile is
 * clicked on the public profile: description, evidence, and the full
 * verification chain (teacher → admin → delivered), plus a link to the
 * permanent public verification page.
 */
export default function AchievementDetailModal({ achievement, open, onOpenChange, endorsements, canEndorse, onEndorse, hasEndorsed, isOwner, isPinned, canPin, onTogglePin }) {
  const [shareOpen, setShareOpen] = useState(false);
  if (!achievement) return null;
  const verifyUrl = achievement.verification_id
    ? `${window.location.origin}/verify/${achievement.verification_id}`
    : achievement.public_verification_url;

  const chain = [
    { Icon: PenLine, label: 'Verified', value: achievement.teacher_name ? `Signed by ${achievement.teacher_name}` : 'Digitally signed', date: achievement.date_approved },
    { Icon: ShieldCheck, label: 'Authorised', value: achievement.admin_name ? `Approved by ${achievement.admin_name}` : 'Approved by the organisation', date: achievement.date_approved },
    { Icon: HardDrive, label: 'Delivered', value: 'Permanently archived to the student vault', date: achievement.date_delivered },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 text-lg leading-snug pr-6">
            <BadgeCheck className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
            {achievement.title}
          </DialogTitle>
          <DialogDescription>
            {achievement.organisation_name}{achievement.date_achieved ? ` · achieved ${fmt(achievement.date_achieved)}` : ''}
          </DialogDescription>
        </DialogHeader>

        {achievement.image_url && (
          <img src={achievement.image_url} alt={achievement.title} className="w-full rounded-xl border border-border" />
        )}

        {achievement.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{achievement.description}</p>
        )}

        {/* Verification chain */}
        <div className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Verification chain</p>
          {chain.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center flex-shrink-0">
                <step.Icon className="h-4 w-4 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{step.value}</p>
                {step.date && <p className="text-xs text-tertiary">{fmt(step.date)}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Evidence */}
        {achievement.evidence_url && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" /> Evidence
            </p>
            <img src={achievement.evidence_url} alt="Evidence" className="w-full rounded-xl border border-border" />
          </div>
        )}

        {/* Peer endorsements — count on the tile expands to the full list here */}
        {(endorsements?.length > 0 || canEndorse) && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Quote className="h-3.5 w-3.5 text-primary" />
              Peer endorsements{endorsements?.length ? ` (${endorsements.length})` : ''}
            </p>
            {endorsements?.length > 0 && <EndorsementList endorsements={endorsements} />}
            {canEndorse && (
              <Button variant="outline" className="w-full" onClick={onEndorse} disabled={hasEndorsed}>
                <Quote className="h-4 w-4 mr-2" />
                {hasEndorsed ? 'You endorsed this' : 'Endorse this achievement'}
              </Button>
            )}
          </div>
        )}

        {/* Owner-only: pin/unpin to Highlights (max 6) */}
        {isOwner && (
          <Button variant="outline" className="w-full" onClick={onTogglePin} disabled={!isPinned && !canPin}>
            <Pin className="h-4 w-4 mr-2" />
            {isPinned ? 'Unpin from highlights' : canPin ? 'Pin to highlights' : 'Highlights are full (6 max)'}
          </Button>
        )}

        {verifyUrl && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" onClick={() => window.open(verifyUrl, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Verification page
            </Button>
          </div>
        )}
        <AchievementShareDialog open={shareOpen} onOpenChange={setShareOpen} achievement={achievement} />
      </DialogContent>
    </Dialog>
  );
}