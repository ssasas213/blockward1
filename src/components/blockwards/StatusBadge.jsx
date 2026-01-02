import React from 'react';
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

export default function StatusBadge({ status }) {
  const statusConfig = {
    pending: {
      icon: Clock,
      label: 'Pending',
      className: 'bg-amber-100 text-amber-700 border-amber-200'
    },
    minted: {
      icon: CheckCircle2,
      label: 'Issued',
      className: 'bg-green-100 text-green-700 border-green-200'
    },
    failed: {
      icon: XCircle,
      label: 'Failed',
      className: 'bg-red-100 text-red-700 border-red-200'
    }
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}