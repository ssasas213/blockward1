import { Clock, PenLine, CheckCircle2, XCircle, Sparkles, Archive, FileCheck, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  draft:                        { label: 'Draft',                      icon: Clock,         class: 'bg-muted text-muted-foreground' },
  submitted:                    { label: 'Submitted',                  icon: Clock,         class: 'bg-primary/10 text-primary' },
  awaiting_teacher_signature:   { label: 'Awaiting Teacher Review',    icon: PenLine,       class: 'bg-warning/10 text-warning' },
  awaiting_admin_signature:     { label: 'Awaiting Admin Approval',    icon: PenLine,       class: 'bg-warning/10 text-warning' },
  approved:                     { label: 'Approved',                   icon: CheckCircle2,  class: 'bg-success/10 text-success' },
  delivered_to_vault:           { label: 'Delivered to Vault',         icon: Shield,        class: 'bg-success/10 text-success' },
  minted:                       { label: 'Ready for Vault',            icon: Sparkles,      class: 'bg-primary/10 text-primary' },
  archived:                     { label: 'Archived',                   icon: Archive,       class: 'bg-muted text-muted-foreground' },
  rejected:                     { label: 'Rejected',                   icon: XCircle,       class: 'bg-destructive/10 text-destructive' },
  active:                       { label: 'Active',                     icon: FileCheck,     class: 'bg-success/10 text-success' },
  awaiting_student_signature:   { label: 'Awaiting Student Signature', icon: PenLine,       class: 'bg-warning/10 text-warning' },
};

export default function RecordStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium", cfg.class)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}