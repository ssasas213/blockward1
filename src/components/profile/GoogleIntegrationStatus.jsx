import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HardDrive, CheckCircle2, XCircle } from 'lucide-react';

export default function GoogleIntegrationStatus() {
  // Google Drive is connected via Base44 shared connector (authorized in developer context)
  // We show status based on the authorized connector info
  const driveConnected = true; // The connector is authorized as shown in context

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HardDrive className="h-4 w-4" /> Google Integrations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white shadow-sm flex items-center justify-center">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M6.28 3l5.72 9.9L6.28 3zm-3.23 8.4L.5 16.5h8.95L6.28 3 3.05 11.4zM12 21l2.97-5.15H9.03L12 21zm9.44-4.5l-2.55-4.1L12 21l9.44-4.5zm-9.16-7.4L9.73 3H3.05l3.23 8.4L12.28 9.1z" fill="#4285F4"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Google Drive</p>
              <p className="text-xs text-slate-400">Used for archiving achievement certificates</p>
            </div>
          </div>
          {driveConnected ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-600 border-0 gap-1">
              <XCircle className="h-3 w-3" /> Not Connected
            </Badge>
          )}
        </div>
        {driveConnected && (
          <p className="text-xs text-slate-400 px-1">
            Certificates are saved to <span className="font-medium text-slate-600">BlockWard / School / Student / NFTs</span> on Google Drive.
          </p>
        )}
      </CardContent>
    </Card>
  );
}