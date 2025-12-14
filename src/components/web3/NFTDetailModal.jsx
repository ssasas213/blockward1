import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function NFTDetailModal({ nft, open, onClose }) {
  if (!nft) return null;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  const attributes = [
    { trait: 'Category', value: nft.category },
    { trait: 'Token ID', value: `#${nft.id}` },
    { trait: 'Date Minted', value: nft.date },
    { trait: 'Chain', value: 'Base' }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-violet-600" />
            {nft.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Image */}
          <div className="aspect-square rounded-xl overflow-hidden">
            <img 
              src={nft.image} 
              alt={nft.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Description</h3>
            <p className="text-slate-600">{nft.description}</p>
          </div>

          {/* Attributes */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Attributes</h3>
            <div className="grid grid-cols-2 gap-3">
              {attributes.map((attr, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">{attr.trait}</p>
                  <p className="font-medium text-slate-900">{attr.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Blockchain Info */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Blockchain</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">Token Standard</span>
                <Badge variant="outline">ERC-721</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">Network</span>
                <Badge variant="outline">Base</Badge>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => copyToClipboard(nft.id.toString())}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Token ID
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              asChild
            >
              <a 
                href={`https://basescan.org/nft/CONTRACT_ADDRESS/${nft.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Basescan
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}