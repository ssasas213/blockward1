import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { ShieldCheck, Share2, Eye, GraduationCap, Trophy, Sparkles, Award, Users, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import InitialsAvatar from '@/components/ui/InitialsAvatar';

const RARITY_TIERS = [
  { name: 'Certified',     accent: 'bg-muted-foreground',  badge: 'bg-muted/60 text-muted-foreground border-border' },
  { name: 'Distinguished', accent: 'bg-primary/60',       badge: 'bg-primary/10 text-primary border-primary/20' },
  { name: 'Elite',         accent: 'bg-accent/60',        badge: 'bg-accent/10 text-accent border-accent/20' },
  { name: 'Exceptional',   accent: 'bg-primary',          badge: 'bg-primary/15 text-primary border-primary/25' },
  { name: 'Legendary',     accent: 'bg-accent',           badge: 'bg-accent/15 text-accent border-accent/25' },
];

const CATEGORY_ICON = {
  academic: GraduationCap, sports: Trophy, arts: Sparkles,
  leadership: ShieldCheck, community: Users, behaviour: Award, special: Award,
};

export function calculateRarity(points) {
  const p = points || 0;
  if (p >= 50) return RARITY_TIERS[4];
  if (p >= 30) return RARITY_TIERS[3];
  if (p >= 15) return RARITY_TIERS[2];
  if (p >= 5)  return RARITY_TIERS[1];
  return RARITY_TIERS[0];
}

export default function BlockWardCard({ blockWard, onClick, onShare, onVerify, showStudent = true }) {
  const rarity = blockWard.rarity
    ? RARITY_TIERS.find(t => t.name === blockWard.rarity) || RARITY_TIERS[0]
    : calculateRarity(blockWard.points);
  const imageUrl = blockWard.image_url && !blockWard.image_url.includes('dicebear') ? blockWard.image_url : null;
  const isVerified = blockWard.verify_id || blockWard.status === 'active' || blockWard.vault_status === 'delivered';
  const CatIcon = CATEGORY_ICON[blockWard.category] || Award;
  const studentName = blockWard.student_name || (showStudent ? null : null);
  const issueDate = blockWard.minted_at || blockWard.issuedAt || blockWard.vault_delivered_at;

  return (
    <Card
      className={cn(
        "overflow-hidden cursor-pointer group transition-all duration-200 card-hover",
        isVerified && "verified-glow"
      )}
      onClick={onClick}
    >
      {/* Rarity accent strip */}
      <div className={cn("h-1", rarity.accent)} />

      {/* Header artwork */}
      <div
        className="h-32 relative"
        style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        {!imageUrl && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-secondary to-accent/10 flex items-center justify-center">
            <CatIcon className="h-12 w-12 text-primary/40" />
          </div>
        )}
        {imageUrl && <div className="absolute inset-0 bg-black/30" />}

        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {isVerified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/20 backdrop-blur-md border border-primary/40 text-[11px] font-semibold text-primary">
              <ShieldCheck className="h-3 w-3" /> Verified
            </span>
          )}
          <span className={cn("px-2 py-0.5 rounded-md text-[11px] font-medium backdrop-blur-md border", rarity.badge)}>
            {rarity.name}
          </span>
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-semibold text-base truncate drop-shadow-sm">{blockWard.title}</h3>
        </div>
      </div>

      {/* Body */}
      <CardContent className="p-4">
        <div className="space-y-3">
          {showStudent && studentName && (
            <div className="flex items-center gap-2">
              <InitialsAvatar name={studentName} size="xs" />
              <span className="text-sm font-medium text-foreground truncate">{studentName}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs capitalize gap-1">
              <CatIcon className="h-3 w-3" />
              {blockWard.category}
            </Badge>
            {blockWard.points > 0 && (
              <span className="text-xs font-semibold text-primary">+{blockWard.points} pts</span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-tertiary">
            <span className="truncate flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {blockWard.issuer_name || blockWard.issuer_email || '—'}
            </span>
            {issueDate && <span className="flex-shrink-0">{format(new Date(issueDate), 'MMM d, yyyy')}</span>}
          </div>

          {/* Actions */}
          {(onShare || onVerify) && (
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
              >
                <Eye className="h-3.5 w-3.5" /> View
              </Button>
              {onShare && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={(e) => { e.stopPropagation(); onShare(); }}
                >
                  <Share2 className="h-3.5 w-3.5" /> Share
                </Button>
              )}
              {onVerify && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={(e) => { e.stopPropagation(); onVerify(); }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Verify
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}