import React, { useState, useEffect } from 'react';
import { useAccount, useEstimateGas } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Fuel, TrendingUp, TrendingDown } from 'lucide-react';

export default function GasEstimator() {
  const { chain } = useAccount();
  const [gasPrice, setGasPrice] = useState(null);

  useEffect(() => {
    // Mock gas price - in production, fetch from chain
    const mockGasPrice = {
      slow: '0.5',
      standard: '1.2',
      fast: '2.1'
    };
    setGasPrice(mockGasPrice);
  }, [chain]);

  if (!gasPrice) return null;

  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <Fuel className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Gas Prices</h3>
            <p className="text-xs text-slate-500">Base Network</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <TrendingDown className="h-4 w-4 text-green-500 mx-auto mb-1" />
            <p className="text-xs text-slate-500 mb-1">Slow</p>
            <p className="font-semibold text-slate-900">{gasPrice.slow} Gwei</p>
          </div>
          <div className="text-center p-3 bg-violet-50 rounded-lg border border-violet-200">
            <Fuel className="h-4 w-4 text-violet-600 mx-auto mb-1" />
            <p className="text-xs text-slate-500 mb-1">Standard</p>
            <p className="font-semibold text-slate-900">{gasPrice.standard} Gwei</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <TrendingUp className="h-4 w-4 text-amber-500 mx-auto mb-1" />
            <p className="text-xs text-slate-500 mb-1">Fast</p>
            <p className="font-semibold text-slate-900">{gasPrice.fast} Gwei</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-green-50 rounded-lg">
          <p className="text-xs text-green-800">
            💡 Base offers significantly lower gas fees than Ethereum mainnet
          </p>
        </div>
      </CardContent>
    </Card>
  );
}