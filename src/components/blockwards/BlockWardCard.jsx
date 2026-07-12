import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const RARITY_TIERS = [
  { name: 'Certified',     accent: 'bg-muted-foreground',  badge: 'bg-muted text-muted-foreground' },
  { name: 'Distinguished', accent: 'bg-primary/60',       badge: 'bg-primary/10 text-primary' },
  { name: 'Elite',         accent: 'bg-accent/60',        badge: 'bg-accent/10 text-accent' },
  { name: 'Exceptional',   accent: 'bg-primary',          badge: 'bg-primary/20 text-primary' },
  { name: 'Legendary',     accent: 'bg-accent',            badge: 'bg-accent/20 text-accent', glow: true },
];

export function calculateRarity(points) {
  const p = points || 0;
  if (p >= 50) return RARITY_TIERS[4];
  if (p >= 30) return RARITY_TIERS[3];
  if (p >= 15) return RARITY_TIERS[2];
  if (p >= 5)  return RARITY_TIERS[1];
  return RARITY_TIERS[0];
}

export default function BlockWardCard({ blockWard, onClick }) {
  const rarity = blockWard.rarity
    ? RARITY_TIERS.find(t => t.name === blockWard.rarity) || RARITY_TIERS[0]
    : calculateRarity(blockWard.points);
  const imageUrl = blockWard.image_url && !blockWard.image_url.includes('dicebear') ? blockWard.image_url : null;

  return (
    <Card
      className={cn(
        "shadow-sm transition-all duration-200 overflow-hidden cursor-pointer group card-hover",
        rarity.glow && "glow-accent"
      )}
      onClick={onClick}
    >
      {/* Rarity accent strip */}
      <div className={cn("h-1", rarity.accent)} />

      {/* Header with image or muted background */}
      <div
        className="h-32 relative"
        style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        {!imageUrl && <div className="absolute inset-0 bg-muted" />}
        {imageUrl && <div className="absolute inset-0 bg-black/30" />}

        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {blockWard.verify_id && (
            <div className="bg-primary/20 backdrop-blur-sm rounded-md p-1 border border-primary/30">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            </div>
          )}
          <span className={cn("px-2 py-0.5 rounded text-xs font-medium backdrop-blur-sm", rarity.badge)}>
            {rarity.name}
          </span>
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-semibold text-base truncate drop-shadow-sm">
            {blockWard.title}
          </h3>
        </div>
      </div>

      {/* Body */}
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs capitalize">
              {blockWard.category}
            </Badge>
            {blockWard.points > 0 && (
              <span className="text-xs font-medium text-primary">+{blockWard.points} pts</span>
            )}
          </div>
          {(blockWard.issuer_name || blockWard.issuer_email) && (
            <p className="text-xs text-muted-foreground truncate">
              Issued by {blockWard.issuer_name || blockWard.issuer_email}
            </p>
          )}
          {(blockWard.minted_at || blockWard.issuedAt) && (
            <p className="text-xs text-muted-foreground">
              {format(new Date(blockWard.minted_at || blockWard.issuedAt), 'MMM d, yyyy')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}