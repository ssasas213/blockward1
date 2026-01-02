import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Shield, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function VaultDetailsModal({ vault, open, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!vault) return null;

  const copyAddress = () => {
    navigator.clipboard.writeText(vault.publicAddress);
    setCopied(true);
    toast.success('Vault ID copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-violet-600" />
            BlockWard Vault
          </DialogTitle>
          <DialogDescription>
            Your secure storage for achievements
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Vault Active</p>
                <p className="text-xs text-green-700">All achievements secured</p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-700 border-green-300">
              Active
            </Badge>
          </div>

          {/* Info */}
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500 mb-1">Created</p>
              <p className="font-medium text-slate-900">
                {format(new Date(vault.createdAt), 'MMMM d, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Managed By</p>
              <p className="font-medium text-slate-900">BlockWard Platform</p>
            </div>
          </div>

          {/* Vault ID */}
          <div className="pt-4 border-t space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-1">
                Vault ID (Advanced)
              </p>
              <p className="text-xs text-slate-500 mb-3">
                This is your unique vault identifier for verification purposes only.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="font-mono text-xs text-slate-700 break-all">
                    {vault.publicAddress}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={copyAddress}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              💡 Your vault is automatically created and secured by BlockWard. 
              You don't need to manage any passwords or recovery phrases.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}