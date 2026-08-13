import React from 'react';
import { format } from 'date-fns';
import {
  Upload, Send, PenLine, ShieldCheck, AlertCircle, RefreshCw, Trophy, HardDrive, CheckCircle2
} from 'lucide-react';

/**
 * WorkflowTimeline — renders the stages that ACTUALLY occurred for an achievement,
 * derived from its audit logs. Only stages with a matching audit entry are shown.
 * Each stage shows the actor name + timestamp when available.
 */
const STAGE_DEFS = [
  { action: 'created',                  label: 'Created',                 icon: Upload },
  { action: 'submitted',                label: 'Submitted for Review',     icon: Send },
  { action: 'teacher_signed',           label: 'Teacher Endorsed',         icon: PenLine },
  { action: 'changes_requested',        label: 'Changes Requested',        icon: AlertCircle },
  { action: 'resubmitted_after_changes', label: 'Resubmitted',             icon: RefreshCw },
  { action: 'admin_signed',             label: 'Admin Approved',          icon: ShieldCheck },
  { action: 'sent_to_student_vault',    label: 'Delivered to Vault',       icon: HardDrive },
];

export default function WorkflowTimeline({ logs = [], record }) {
  // Build a map of action → most recent log entry for that action
  const byAction = {};
  for (const log of logs) {
    if (!byAction[log.action]) byAction[log.action] = log;
  }

  const stages = STAGE_DEFS.filter(s => byAction[s.action]);

  // Append a "Verified" final stage if delivered + has verify_id
  const verified = record?.status === 'delivered_to_vault' && record?.verify_id;
  if (verified) {
    stages.push({ action: 'verified', label: 'Verified', icon: CheckCircle2, _verified: true, _log: { actor_name: 'BlockWard Registry', timestamp: record?.vault_delivered_at } });
  }

  if (!stages.length) {
    return <p className="text-sm text-muted-foreground py-2">No workflow history yet.</p>;
  }

  return (
    <div className="space-y-0">
      {stages.map((stage, i) => {
        const log = stage._log || byAction[stage.action];
        const Icon = stage.icon;
        const isLast = i === stages.length - 1;
        return (
          <div key={stage.action + i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              {!isLast && <div className="w-px bg-border flex-1 my-0.5" />}
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{stage.label}</p>
              <p className="text-xs text-muted-foreground">
                {log?.actor_name ? `${log.actor_name}` : ''}
                {log?.actor_role ? ` · ${log.actor_role}` : ''}
                {log?.timestamp ? ` · ${format(new Date(log.timestamp), 'MMM d, yyyy HH:mm')}` : ''}
              </p>
              {log?.notes && <p className="text-xs text-muted-foreground mt-0.5 italic line-clamp-2">{log.notes}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}