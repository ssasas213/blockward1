import React from 'react';
import { Badge } from '@/components/ui/badge';
import { HardDrive, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

/**
 * DriveStatusBadge — Shows the student's Google Drive connection status.
 *
 * States:
 * - connected: Student has an active Drive connection (green)
 * - expired: Student previously connected but token is no longer valid (orange)
 * - not_connected: Student has never connected their Drive (red)
 */
export default function DriveStatusBadge({ connected, hasEmail, email, size = 'sm' }) {
  const isConnected = connected;
  const isExpired = !connected && hasEmail;
  const isNotConnected = !connected && !hasEmail;

  const sizeClass = size === 'lg' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5';

  if (isConnected) {
    return (
      <Badge className={`bg-emerald-100 text-emerald-700 border border-emerald-200 gap-1 ${sizeClass}`}>
        <CheckCircle2 className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} />
        Drive Connected{email ? `: ${email}` : ''}
      </Badge>
    );
  }

  if (isExpired) {
    return (
      <Badge className={`bg-amber-100 text-amber-700 border border-amber-200 gap-1 ${sizeClass}`}>
        <AlertTriangle className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} />
        Drive Connection Expired
      </Badge>
    );
  }

  return (
    <Badge className={`bg-red-100 text-red-700 border border-red-200 gap-1 ${sizeClass}`}>
      <XCircle className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} />
      Drive Not Connected
    </Badge>
  );
}