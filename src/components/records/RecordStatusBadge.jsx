import { Clock, PenLine, CheckCircle2, XCircle, Sparkles, Archive, FileCheck, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  draft:                        { label: 'Draft',                      icon: Clock,         class: 'bg-slate-100 text-slate-600' },
  submitted:                    { label: 'Submitted',                  icon: Clock,         class: 'bg-blue-100 text-blue-700' },
  awaiting_teacher_signature:   { label: 'Awaiting Teacher Review',    icon: PenLine,       class: 'bg-amber-100 text-amber-700' },
  awaiting_admin_signature:     { label: 'Awaiting Admin Approval',    icon: PenLine,       class: 'bg-amber-100 text-amber-700' },
  approved:                     { label: 'Approved',                   icon: CheckCircle2,  class: 'bg-emerald-100 text-emerald-700' },
  delivered_to_vault:           { label: 'Delivered to Vault',         icon: Shield,        class: 'bg-emerald-100 text-emerald-700' },
  minted:                       { label: 'Ready for Vault',            icon: Sparkles,      class: 'bg-indigo-100 text-indigo-700' },
  archived:                     { label: 'Archived',                   icon: Archive,       class: 'bg-slate-100 text-slate-600' },
  rejected:                     { label: 'Rejected',                   icon: XCircle,       class: 'bg-red-100 text-red-700' },
  active:                       { label: 'Active',                     icon: FileCheck,     class: 'bg-emerald-100 text-emerald-700' },
  awaiting_student_signature:   { label: 'Awaiting Student Signature', icon: PenLine,       class: 'bg-amber-100 text-amber-700' },
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