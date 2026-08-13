import React from 'react';
import { format } from 'date-fns';
import {
  Upload, Send, PenLine, ShieldCheck, HardDrive, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * WorkflowStepper — renders the FULL achievement lifecycle with completed (✓),
 * current (●) and pending (○) stages, derived from record.status.
 * Friendly labels (no technical status names).
 */
const STAGES = [
  { key: 'created',  label: 'Created',            icon: Upload },
  { key: 'submitted', label: 'Submitted',         icon: Send },
  { key: 'teacher',  label: 'Teacher Endorsed',   icon: PenLine },
  { key: 'admin',    label: 'Administrator Review', icon: ShieldCheck },
  { key: 'vault',    label: 'Student Vault',      icon: HardDrive },
  { key: 'verified', label: 'Verified',           icon: CheckCircle2 },
];

function getProgress(status, record) {
  // returns { completed, current, rejected, changes }
  switch (status) {
    case 'draft': return { completed: 0, current: 0 };
    case 'submitted':
    case 'awaiting_teacher_signature': return { completed: 1, current: 2 };
    case 'awaiting_admin_signature': return { completed: 2, current: 3 };
    case 'changes_requested': return { completed: 2, current: 3, changes: true };
    case 'approved': return { completed: 3, current: 4 };
    case 'delivering': return { completed: 3, current: 4, delivering: true };
    case 'delivered_to_vault':
      return record?.verify_id ? { completed: 5 } : { completed: 4, current: 5 };
    case 'rejected': return { completed: 1, current: 2, rejected: true };
    default: return { completed: 0, current: 0 };
  }
}

const STATUS_LABEL = {
  draft: 'Draft',
  submitted: 'Submitted for Review',
  awaiting_teacher_signature: 'Waiting for Teacher',
  awaiting_admin_signature: 'Waiting for Administrator',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  delivering: 'Delivering BlockWard…',
  delivered_to_vault: 'Delivered to Vault',
  rejected: 'Rejected',
};

export default function WorkflowStepper({ record }) {
  const status = record?.status;
  const { completed, current, rejected, changes, delivering } = getProgress(status, record);
  const allDone = completed >= STAGES.length;

  return (
    <div>
      {/* Current status hero */}
      <div className="flex items-center gap-3 mb-5">
        <span className={cn(
          "h-2.5 w-2.5 rounded-full flex-shrink-0",
          rejected ? 'bg-destructive' : changes ? 'bg-warning' : allDone ? 'bg-success' : 'bg-primary animate-pulse'
        )} />
        <p className="text-sm font-semibold text-foreground">
          {rejected ? 'Rejected' : changes ? 'Changes Requested' : STATUS_LABEL[status] || 'In Progress'}
        </p>
        {!allDone && !rejected && (
          <span className="text-xs text-tertiary">— {STAGES[current]?.label}</span>
        )}
      </div>

      {/* Stepper */}
      <div className="space-y-0">
        {STAGES.map((stage, i) => {
          const isDone = i < completed;
          const isCurrent = i === current && !allDone && !rejected;
          const isPending = i > completed && !isCurrent;
          const Icon = stage.icon;
          return (
            <div key={stage.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors",
                  isDone && "bg-success/15 border-success/30",
                  isCurrent && "bg-primary/15 border-primary/40",
                  isPending && "bg-secondary border-border"
                )}>
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : isCurrent ? (
                    delivering ? <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    : <span className="h-2 w-2 rounded-full bg-primary" />
                  ) : (
                    <Icon className="h-3.5 w-3.5 text-tertiary" />
                  )}
                </div>
                {i < STAGES.length - 1 && (
                  <div className={cn("w-px flex-1 my-0.5 min-h-[20px]", isDone ? "bg-success/30" : "bg-border")} />
                )}
              </div>
              <div className="pb-4 flex-1 min-w-0 pt-1">
                <p className={cn(
                  "text-sm font-medium",
                  isDone ? "text-foreground" : isCurrent ? "text-foreground" : "text-tertiary"
                )}>
                  {stage.label}
                </p>
                {isCurrent && delivering && (
                  <p className="text-xs text-primary mt-0.5">Securing BlockWard…</p>
                )}
                {isCurrent && changes && i === 3 && (
                  <p className="text-xs text-warning mt-0.5">Admin has requested changes</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {rejected && record?.rejection_reason && (
        <div className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <p className="text-xs font-medium text-destructive mb-0.5">Rejection Reason</p>
          <p className="text-xs text-muted-foreground">{record.rejection_reason}</p>
        </div>
      )}
    </div>
  );
}