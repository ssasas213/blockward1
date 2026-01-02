import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Zap, CheckCircle } from 'lucide-react';

export default function IssuerStatusCard({ profile }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-slate-500 text-sm">Issuer Status</p>
              <p className="font-semibold text-lg text-slate-900">Authorized</p>
            </div>
          </div>
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-slate-600">Gas Fees</span>
            </div>
            <Badge variant="outline" className="text-xs">
              Sponsored by BlockWard
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-500" />
              <span className="text-sm text-slate-600">Issuing Rights</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {profile?.can_issue_blockwards ? 'Enabled' : 'Pending'}
            </Badge>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-4 flex items-start gap-2">
          <Shield className="h-3 w-3 flex-shrink-0 mt-0.5" />
          BlockWards are issued directly to student vaults. No manual transactions required.
        </p>
      </CardContent>
    </Card>
  );
}