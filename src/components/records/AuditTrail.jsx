import React from 'react';
import { format } from 'date-fns';
import { CheckCircle2, PenLine, Upload, FileCheck, XCircle, Eye, Send, HardDrive, AlertCircle } from 'lucide-react';

const ACTION_CONFIG = {
  created:         { icon: Upload,       color: 'text-blue-500',   label: 'Record created' },
  submitted:       { icon: Send,         color: 'text-indigo-500', label: 'Submitted for review' },
  admin_signed:    { icon: PenLine,      color: 'text-violet-600', label: 'Admin signed' },
  admin_rejected:  { icon: XCircle,      color: 'text-red-500',    label: 'Admin rejected' },
  student_signed:  { icon: CheckCircle2, color: 'text-emerald-600',label: 'Student signed' },
  drive_saved:     { icon: HardDrive,    color: 'text-purple-600', label: 'Saved to Drive' },
  status_changed:  { icon: FileCheck,    color: 'text-slate-500',  label: 'Status changed' },
  viewed:          { icon: Eye,          color: 'text-slate-400',  label: 'Viewed' },
  sent_to_student_vault: { icon: HardDrive, color: 'text-emerald-600', label: 'Delivered to vault' },
  changes_requested:     { icon: AlertCircle, color: 'text-amber-500', label: 'Changes requested by admin' },
  resubmitted_after_changes: { icon: Send, color: 'text-indigo-500', label: 'Resubmitted after changes' },
};

export default function AuditTrail({ logs }) {
  if (!logs?.length) {
    return <p className="text-sm text-slate-400 py-4 text-center">No audit history yet.</p>;
  }

  return (
    <div className="space-y-0">
      {logs.map((log, i) => {
        const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.status_changed;
        const Icon = cfg.icon;
        return (
          <div key={log.id} className="flex gap-3 group">
            <div className="flex flex-col items-center">
              <div className={`h-8 w-8 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center flex-shrink-0 z-10`}>
                <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
              </div>
              {i < logs.length - 1 && <div className="w-0.5 bg-slate-200 flex-1 my-0.5" />}
            </div>
            <div className="pb-4 flex-1">
              <p className="text-sm font-medium text-slate-800">{cfg.label}</p>
              <p className="text-xs text-slate-500">
                {log.actor_name} ({log.actor_role}) — {log.timestamp ? format(new Date(log.timestamp), 'MMM d, yyyy HH:mm') : ''}
              </p>
              {log.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{log.notes}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}