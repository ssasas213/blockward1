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

  return (
    <Card className="border-2 border-violet-200 shadow-lg">
      <div className={`h-40 bg-gradient-to-br ${gradientClass} p-6 flex flex-col justify-between`}>
        <div className="flex items-center justify-between">
          <div className="text-6xl">{blockWard.icon || '🏆'}</div>
          <Badge className="bg-white/30 text-white border-0 backdrop-blur-sm">
            {blockWard.rarity}
          </Badge>
        </div>
        <div>
          <h3 className="text-white font-bold text-xl">{blockWard.title || 'Untitled'}</h3>
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