import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ShieldCheck } from 'lucide-react';

const RARITY_TIERS = [
  { name: 'Certified',     accent: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600' },
  { name: 'Distinguished', accent: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700' },
  { name: 'Elite',         accent: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700' },
  { name: 'Exceptional',   accent: 'bg-purple-500',  badge: 'bg-purple-100 text-purple-700' },
  { name: 'Legendary',     accent: 'bg-violet-600',  badge: 'bg-violet-100 text-violet-700' },
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
      className="shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden cursor-pointer group"
      onClick={onClick}
    >
      {/* Rarity accent strip */}
      <div className={`h-1 ${rarity.accent}`} />

      {/* Header with image or muted background */}
      <div
        className="h-32 relative"
        style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        {!imageUrl && <div className="absolute inset-0 bg-muted" />}
        {imageUrl && <div className="absolute inset-0 bg-black/30" />}

        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {blockWard.verify_id && (
            <div className="bg-white/90 rounded-md p-1">
              <ShieldCheck className="h-3.5 w-3.5 text-foreground" />
            </div>
          )}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${rarity.badge}`}>
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