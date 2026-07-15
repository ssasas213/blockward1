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
    <Card className="border-border bg-card/60 backdrop-blur-md shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-foreground">
          <Lock className="h-4 w-4 text-primary" /> Security
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
              <p className="text-xs text-muted-foreground">Extra security for your account</p>
            </div>
          </div>
          <Badge variant="outline" className="text-muted-foreground border-border bg-muted/30 text-xs">Coming Soon</Badge>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Active Sessions</p>
              <p className="text-xs text-muted-foreground">Managed by your identity provider</p>
            </div>
          </div>
          <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-xs gap-1">
            1 Active
          </Badge>
        </div>

        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
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