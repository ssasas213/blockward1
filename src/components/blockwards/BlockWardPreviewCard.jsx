import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const rarityColors = {
  Common: 'from-slate-400 to-slate-600',
  Rare: 'from-blue-500 to-indigo-600',
  Legendary: 'from-amber-500 to-orange-600'
};

export default function BlockWardPreviewCard({ blockWard }) {
  const gradientClass = rarityColors[blockWard.rarity] || rarityColors.Common;

  const imageUrl = blockWard.imageUrl || blockWard.image_url;

  return (
    <Card className="border-2 border-violet-200 shadow-lg overflow-hidden">
      <div
        className={`h-40 p-6 flex flex-col justify-between relative ${!imageUrl ? `bg-gradient-to-br ${gradientClass}` : ''}`}
        style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        {imageUrl && <div className="absolute inset-0 bg-black/40" />}
        <div className="flex items-center justify-between relative z-10">
          <div className="text-6xl">{!imageUrl ? (blockWard.icon || '🏆') : ''}</div>
          <Badge className="bg-white/30 text-white border-0 backdrop-blur-sm">
            {blockWard.rarity}
          </Badge>
        </div>
        <div className="relative z-10">
          <h3 className="text-white font-bold text-xl drop-shadow">{blockWard.title || 'Untitled'}</h3>
        </div>
      </div>
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="text-xs text-slate-500 mb-1">Category</p>
          <Badge variant="outline">{blockWard.category || 'Not set'}</Badge>
        </div>
        {blockWard.description && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Description</p>
            <p className="text-sm text-slate-700">{blockWard.description}</p>
          </div>
        )}
        <div className="pt-2 border-t">
          <p className="text-xs text-slate-400">
            💡 This achievement will be permanently stored
          </p>
        </div>
      </CardContent>
    </Card>
  );
}