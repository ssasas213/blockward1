import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Copy, Check, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function VaultStatusCard({ walletAddress, onOpenVault }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast.success('Vault ID copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-white/80 text-sm">BlockWard Vault</p>
              <p className="font-semibold text-lg">Active & Secure</p>
            </div>
          </div>
          <Badge className="bg-white/20 text-white border-0">
            <div className="h-2 w-2 rounded-full bg-green-400 mr-2" />
            Active
          </Badge>
        </div>
        
        {walletAddress && (
          <div className="bg-white/10 rounded-lg p-3 mb-4">
            <p className="text-white/60 text-xs mb-1">Vault ID (Advanced)</p>
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-sm truncate">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyAddress}
                className="h-8 text-white hover:bg-white/10"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 text-white/80 text-xs mb-4">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>Your BlockWards are automatically stored in your secure vault. No wallet setup required.</p>
        </div>

        <Button
          onClick={onOpenVault}
          variant="secondary"
          className="w-full bg-white text-violet-600 hover:bg-white/90"
        >
          View Vault Details
        </Button>
      </CardContent>
    </Card>
  );
}