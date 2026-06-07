import { Badge } from '@/components/ui/badge';
import { Clock, PenLine, CheckCircle2, XCircle, HardDrive, Sparkles, Archive, FileCheck } from 'lucide-react';

const STATUS_CONFIG = {
  draft:                        { label: 'Draft',                      icon: Clock,         class: 'bg-slate-100 text-slate-600' },
  submitted:                    { label: 'Submitted',                  icon: Clock,         class: 'bg-blue-100 text-blue-700' },
  awaiting_teacher_signature:   { label: 'Awaiting Teacher Review',   icon: PenLine,       class: 'bg-amber-100 text-amber-700' },
  awaiting_admin_signature:     { label: 'Awaiting Admin Approval',   icon: PenLine,       class: 'bg-orange-100 text-orange-700' },
  approved:                     { label: 'Approved — Ready to Mint',  icon: CheckCircle2,  class: 'bg-green-100 text-green-700' },
  minted:                       { label: 'NFT Minted',                icon: Sparkles,      class: 'bg-violet-100 text-violet-700' },
  archived:                     { label: 'Archived to Drive',         icon: Archive,       class: 'bg-emerald-100 text-emerald-700' },
  rejected:                     { label: 'Rejected',                  icon: XCircle,       class: 'bg-red-100 text-red-700' },
  // legacy statuses
  active:                       { label: 'Active',                    icon: FileCheck,     class: 'bg-emerald-100 text-emerald-700' },
  pending_drive_save:           { label: 'Pending Drive Save',        icon: HardDrive,     class: 'bg-purple-100 text-purple-700' },
  awaiting_student_signature:   { label: 'Awaiting Student Signature',icon: PenLine,       class: 'bg-orange-100 text-orange-700' },
};

export default function RecordStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <Badge className={`${cfg.class} border-0 gap-1`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}