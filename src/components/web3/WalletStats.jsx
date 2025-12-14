import React, { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, Award } from 'lucide-react';

export default function WalletStats() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const [nftCount, setNftCount] = useState(0);

  useEffect(() => {
    if (address) {
      // Mock NFT count - in production, fetch from contract
      setNftCount(Math.floor(Math.random() * 10));
    }
  }, [address]);

  if (!isConnected) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Balance</p>
              <p className="text-xl font-bold text-slate-900">
                {balance ? parseFloat(balance.formatted).toFixed(4) : '0.0000'} ETH
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">BlockWards</p>
              <p className="text-xl font-bold text-slate-900">{nftCount}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-violet-100 flex items-center justify-center">
              <Award className="h-6 w-6 text-violet-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Network</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-green-100 text-green-700">
                  Connected
                </Badge>
              </div>
            </div>
            <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}