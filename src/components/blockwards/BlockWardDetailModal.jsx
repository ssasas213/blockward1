import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { Calendar, User, Award } from 'lucide-react';

const rarityColors = {
  Common: 'from-slate-400 to-slate-600',
  Rare: 'from-blue-500 to-indigo-600',
  Legendary: 'from-amber-500 to-orange-600'
};

export default function BlockWardDetailModal({ blockWard, open, onClose }) {
  if (!blockWard) return null;

  const gradientClass = rarityColors[blockWard.rarity] || rarityColors.Common;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Achievement Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Card Preview */}
          <div className={`h-40 bg-gradient-to-br ${gradientClass} rounded-xl p-6 flex flex-col justify-between`}>
            <div className="flex items-center justify-between">
              <div className="text-6xl">{blockWard.icon || '🏆'}</div>
              <Badge className="bg-white/30 text-white border-0 backdrop-blur-sm">
                {blockWard.rarity}
              </Badge>
            </div>
            <div>
              <h3 className="text-white font-bold text-2xl">{blockWard.title}</h3>
            </div>
          </div>

          {/* Description */}
          {blockWard.description && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Description</h4>
              <p className="text-slate-600">{blockWard.description}</p>
            </div>
          )}

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Award className="h-5 w-5 text-violet-600" />
              <div>
                <p className="text-xs text-slate-500">Category</p>
                <p className="font-medium text-slate-900">{blockWard.category}</p>
              </div>
            </div>
            
            {blockWard.issuedBy && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <User className="h-5 w-5 text-violet-600" />
                <div>
                  <p className="text-xs text-slate-500">Issued By</p>
                  <p className="font-medium text-slate-900">{blockWard.issuedBy}</p>
                </div>
              </div>
            )}
            
            {blockWard.issuedAt && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Calendar className="h-5 w-5 text-violet-600" />
                <div>
                  <p className="text-xs text-slate-500">Earned On</p>
                  <p className="font-medium text-slate-900">
                    {format(new Date(blockWard.issuedAt), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
            <p className="text-sm text-violet-900">
              🔒 This achievement is permanently stored and cannot be transferred.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}