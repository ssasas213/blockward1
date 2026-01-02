import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const rarityColors = {
  Common: 'from-slate-400 to-slate-600',
  Rare: 'from-blue-500 to-indigo-600',
  Legendary: 'from-amber-500 to-orange-600'
};

export default function BlockWardCard({ blockWard, onClick }) {
  const gradientClass = rarityColors[blockWard.rarity] || rarityColors.Common;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className="border-0 shadow-lg hover:shadow-xl transition-all overflow-hidden cursor-pointer group"
        onClick={onClick}
      >
        <div className={`h-32 bg-gradient-to-br ${gradientClass} p-6 flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <div className="text-5xl">{blockWard.icon || '🏆'}</div>
            <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">
              {blockWard.rarity}
            </Badge>
          </div>
          <div>
            <h3 className="text-white font-bold text-lg truncate group-hover:scale-105 transition-transform">
              {blockWard.title}
            </h3>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="space-y-2">
            <Badge variant="outline" className="text-xs">
              {blockWard.category}
            </Badge>
            {blockWard.issuedBy && (
              <p className="text-xs text-slate-500">
                Issued by {blockWard.issuedBy}
              </p>
            )}
            {blockWard.issuedAt && (
              <p className="text-xs text-slate-400">
                {format(new Date(blockWard.issuedAt), 'MMM d, yyyy')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}