import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Info } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function StudentVaultView() {
  return (
    <div className="space-y-6">
      <Alert className="border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50">
        <Shield className="h-4 w-4 text-violet-600" />
        <AlertDescription className="text-violet-900">
          <strong>Your BlockWard Vault is automatic.</strong> You don't need to do anything. 
          Your teacher issues BlockWards directly to your secure vault.
        </AlertDescription>
      </Alert>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-violet-600" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">
              1
            </div>
            <div>
              <p className="font-medium text-slate-900">Your teacher issues a BlockWard</p>
              <p className="text-sm text-slate-600">
                When you earn an achievement, your teacher creates a BlockWard for you.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">
              2
            </div>
            <div>
              <p className="font-medium text-slate-900">It's automatically stored</p>
              <p className="text-sm text-slate-600">
                The BlockWard appears in your collection instantly. No action needed.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">
              3
            </div>
            <div>
              <p className="font-medium text-slate-900">Forever verified</p>
              <p className="text-sm text-slate-600">
                Your achievements are permanently recorded and can't be changed or deleted.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg bg-slate-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-900 mb-1">No wallet setup required</p>
              <p>
                Unlike traditional blockchain systems, you don't need to install any software, 
                manage passwords, or worry about losing access. Your BlockWard Vault is managed 
                securely by your school.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}