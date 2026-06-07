import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, LogOut, Shield, Smartphone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

export default function SecuritySection() {
  const logoutAll = () => {
    base44.auth.logout(createPageUrl('Home'));
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="h-4 w-4" /> Security
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700">Two-Factor Authentication</p>
              <p className="text-xs text-slate-400">Extra security for your account</p>
            </div>
          </div>
          <Badge className="bg-slate-100 text-slate-500 border-0 text-xs">Coming Soon</Badge>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700">Active Sessions</p>
              <p className="text-xs text-slate-400">Managed by your identity provider</p>
            </div>
          </div>
          <Badge className="bg-emerald-100 text-emerald-600 border-0 text-xs">1 Active</Badge>
        </div>

        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full border-red-200 text-red-600 hover:bg-red-50"
            onClick={logoutAll}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out of All Devices
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}