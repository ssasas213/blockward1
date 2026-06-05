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
  const imageUrl = blockWard.image_url && !blockWard.image_url.includes('dicebear') ? blockWard.image_url : null;
  const issuedBy = blockWard.issuer_name || blockWard.issuedBy;
  const issuedAt = blockWard.minted_at || blockWard.issuedAt;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Achievement Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Card Preview */}
          <div
            className={`h-40 rounded-xl p-6 flex flex-col justify-between relative ${!imageUrl ? `bg-gradient-to-br ${gradientClass}` : ''}`}
            style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
          >
            {imageUrl && <div className="absolute inset-0 bg-black/50 rounded-xl" />}
            <div className="flex items-center justify-between relative z-10">
              {!imageUrl && <div className="text-6xl">{blockWard.icon || '🏆'}</div>}
              <div className="ml-auto">
                <Badge className="bg-white/30 text-white border-0 backdrop-blur-sm">
                  {blockWard.rarity || 'Common'}
                </Badge>
              </div>
            </div>
            <div className="relative z-10">
              <h3 className="text-white font-bold text-2xl drop-shadow-md">{blockWard.title}</h3>
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
            
            {issuedBy && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <User className="h-5 w-5 text-violet-600" />
                <div>
                  <p className="text-xs text-slate-500">Issued By</p>
                  <p className="font-medium text-slate-900">{issuedBy}</p>
                </div>
              </div>
            )}
            
            {issuedAt && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Calendar className="h-5 w-5 text-violet-600" />
                <div>
                  <p className="text-xs text-slate-500">Earned On</p>
                  <p className="font-medium text-slate-900">
                    {format(new Date(issuedAt), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
            )}
            {blockWard.transaction_hash && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Award className="h-5 w-5 text-violet-600" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Token ID #{blockWard.token_id}</p>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${blockWard.transaction_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-violet-600 hover:underline font-mono break-all"
                  >
                    {blockWard.transaction_hash.slice(0, 20)}...
                  </a>
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