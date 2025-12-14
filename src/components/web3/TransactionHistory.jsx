import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function TransactionHistory() {
  const { address } = useAccount();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (address) {
      loadTransactions();
    }
  }, [address]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      // Mock data - in production, fetch from blockchain explorer API
      const mockTxs = [
        {
          hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          type: 'Mint BlockWard',
          status: 'success',
          timestamp: new Date().getTime() - 3600000,
          gasUsed: '0.0001 ETH'
        },
        {
          hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          type: 'Grant Role',
          status: 'success',
          timestamp: new Date().getTime() - 7200000,
          gasUsed: '0.0002 ETH'
        }
      ];
      setTransactions(mockTxs);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  if (!address) {
    return null;
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg">Transaction History</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No transactions yet</div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(tx.status)}
                  <div>
                    <p className="font-medium text-slate-900">{tx.type}</p>
                    <p className="text-xs text-slate-500">
                      {format(tx.timestamp, 'PPp')} • Gas: {tx.gasUsed}
                    </p>
                  </div>
                </div>
                <a
                  href={`https://basescan.org/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 hover:text-violet-700"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}