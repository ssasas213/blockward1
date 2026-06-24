import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

const RARITY_TIERS = [
  { name: 'Certified',    icon: '🏅', gradient: 'from-slate-500 to-slate-700',   glow: 'group-hover:shadow-slate-400/40',   ring: 'ring-1 ring-slate-300',    badge: 'bg-slate-100 text-slate-700' },
  { name: 'Distinguished', icon: '🥈', gradient: 'from-blue-500 to-cyan-600',    glow: 'group-hover:shadow-blue-500/40',   ring: 'ring-1 ring-blue-300',     badge: 'bg-blue-100 text-blue-700' },
  { name: 'Elite',         icon: '🥇', gradient: 'from-amber-500 to-yellow-600',  glow: 'group-hover:shadow-amber-500/50',  ring: 'ring-2 ring-amber-300',    badge: 'bg-amber-100 text-amber-700' },
  { name: 'Exceptional',   icon: '💎', gradient: 'from-purple-500 to-pink-600',  glow: 'group-hover:shadow-purple-500/50',  ring: 'ring-2 ring-purple-300',    badge: 'bg-purple-100 text-purple-700' },
  { name: 'Legendary',     icon: '👑', gradient: 'from-violet-600 via-purple-600 to-indigo-600', glow: 'group-hover:shadow-violet-500/60', ring: 'ring-2 ring-violet-400', badge: 'bg-violet-100 text-violet-700' },
];

export function calculateRarity(points) {
  const p = points || 0;
  if (p >= 50) return RARITY_TIERS[4]; // Legendary
  if (p >= 30) return RARITY_TIERS[3]; // Exceptional
  if (p >= 15) return RARITY_TIERS[2]; // Elite
  if (p >= 5)  return RARITY_TIERS[1]; // Distinguished
  return RARITY_TIERS[0];              // Certified
}

export default function BlockWardCard({ blockWard, onClick }) {
  const rarity = blockWard.rarity
    ? RARITY_TIERS.find(t => t.name === blockWard.rarity) || RARITY_TIERS[0]
    : calculateRarity(blockWard.points);
  const imageUrl = blockWard.image_url && !blockWard.image_url.includes('dicebear') ? blockWard.image_url : null;
  const isLegendary = rarity.name === 'Legendary';

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <Card
        className={`border-0 shadow-lg ${rarity.glow} hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer group ${rarity.ring} ${isLegendary ? 'animate-[shimmer_3s_ease-in-out_infinite]' : ''}`}
        onClick={onClick}
      >
        {/* Header with gradient / image */}
        <div
          className={`h-36 p-5 flex flex-col justify-between relative ${!imageUrl ? `bg-gradient-to-br ${rarity.gradient}` : ''}`}
          style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
          {imageUrl && <div className="absolute inset-0 bg-black/40" />}
          {isLegendary && !imageUrl && <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />}

          <div className="flex items-center justify-between relative z-10">
            {!imageUrl && <div className="text-4xl drop-shadow-lg">{rarity.icon}</div>}
            <div className="ml-auto flex items-center gap-1.5">
              {blockWard.verify_id && (
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <Badge className="bg-white/25 text-white border-0 backdrop-blur-sm text-xs font-semibold">
                {rarity.icon} {rarity.name}
              </Badge>
            </div>
          </div>

          <div className="relative z-10">
            <h3 className="text-white font-bold text-lg truncate group-hover:scale-105 transition-transform origin-left drop-shadow-md">
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
                <span className="text-xs font-semibold text-violet-600">+{blockWard.points} pts</span>
              )}
            </div>
            {(blockWard.issuer_name || blockWard.issuer_email) && (
              <p className="text-xs text-slate-500 truncate">
                Issued by {blockWard.issuer_name || blockWard.issuer_email}
              </p>
            )}
            {(blockWard.minted_at || blockWard.issuedAt) && (
              <p className="text-xs text-slate-400">
                {format(new Date(blockWard.minted_at || blockWard.issuedAt), 'MMM d, yyyy')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}