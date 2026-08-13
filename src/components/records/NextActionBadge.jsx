import React from 'react';
import { cn } from '@/lib/utils';
import { getNextAction } from '@/lib/recordWorkflow';
import { Clock, PenLine, Shield, RefreshCw, SendHorizonal, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const ROLE_ICON = {
  student: PenLine,
  teacher: PenLine,
  admin: Shield,
  student_or_teacher: RefreshCw,
  none: null,
};

const TONE_CLASS = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  ready: 'bg-success/10 text-success border-success/20',
  done: 'bg-success/10 text-success border-success/20',
  blocked: 'bg-destructive/10 text-destructive border-destructive/20',
};

const STATUS_ICON = {
  draft: Clock,
  awaiting_teacher_signature: PenLine,
  awaiting_admin_signature: Shield,
  changes_requested: RefreshCw,
  approved: SendHorizonal,
  delivering: Loader2,
  delivered_to_vault: CheckCircle2,
  rejected: XCircle,
};

/**
 * NextActionBadge — shows who owns the next action for an achievement.
 * Derived purely from the canonical record status + origin (no second source of truth).
 */
export default function NextActionBadge({ status, record, className }) {
  const next = getNextAction(status, record);
  const Icon = STATUS_ICON[status] || (next.role === 'none' ? CheckCircle2 : Clock);
  const isDelivering = status === 'delivering';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border',
        TONE_CLASS[next.tone] || TONE_CLASS.pending,
        className
      )}
      title={`Next action: ${next.role === 'none' ? 'none' : next.role}`}
    >
      <Icon className={cn('h-3 w-3', isDelivering && 'animate-spin')} />
      {next.label}
    </span>
  );
}