import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Info } from 'lucide-react';

// IMPORTANT: This page is temporarily disabled to prevent any MetaMask/Web3 library initialization.
// BlockWard uses PLATFORM-MANAGED WALLETS ONLY via backend functions.
// All NFT minting happens server-side through /functions/issueBlockWard.
// Students and teachers DO NOT need browser wallets.

function Web3BlockWardsContent() {
  return (
    <div className="max-w-3xl mx-auto py-16">
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
        <CardContent className="p-12 text-center">
          <div className="h-20 w-20 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-6">
            <Shield className="h-10 w-10 text-violet-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Web3 BlockWards Page (Under Maintenance)
          </h2>
          <p className="text-slate-600 mb-6">
            This page is temporarily unavailable while we finalize the blockchain integration.
          </p>
          <div className="bg-white/80 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3 text-left">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-700">
                <p className="font-medium mb-2">Important: Platform-Managed Wallets</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>No MetaMask or browser wallet required</li>
                  <li>All minting happens server-side</li>
                  <li>Students receive NFTs automatically in their BlockWard Vault</li>
                  <li>Teachers issue BlockWards via the standard interface</li>
                </ul>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Please use the regular <strong>BlockWards</strong> or <strong>Teacher BlockWards</strong> pages for now.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Web3BlockWards() {
  return (
    <ProtectedRoute>
      <Web3BlockWardsContent />
    </ProtectedRoute>
  );
}