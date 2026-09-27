import React from 'react';
import { format } from 'date-fns';
import { CheckCircle2, PenLine, Upload, FileCheck, XCircle, Eye, Send, HardDrive, AlertCircle, Building2, Shield, Users } from 'lucide-react';

// Human-language labels for every audit action — the admin UI never shows
// raw internal event names. Icons/colours use the design-system tokens.
const ACTION_CONFIG = {
  created:         { icon: Upload,       cls: 'text-info',          label: 'Record created' },
  submitted:       { icon: Send,         cls: 'text-info',          label: 'Submitted for review' },
  resubmitted_after_changes: { icon: Send, cls: 'text-info',        label: 'Resubmitted after changes' },
  teacher_signed:  { icon: PenLine,      cls: 'text-primary',       label: 'Verifier signed' },
  teacher_approved:{ icon: CheckCircle2, cls: 'text-success',       label: 'Teacher approved' },
  teacher_rejected:{ icon: XCircle,      cls: 'text-destructive',   label: 'Teacher rejected' },
  admin_signed:    { icon: PenLine,      cls: 'text-primary',       label: 'Admin signed' },
  admin_rejected:  { icon: XCircle,      cls: 'text-destructive',   label: 'Admin rejected' },
  student_signed:  { icon: CheckCircle2, cls: 'text-success',       label: 'Student signed' },
  drive_saved:     { icon: HardDrive,    cls: 'text-info',          label: 'Saved to Drive' },
  status_changed:  { icon: FileCheck,    cls: 'text-muted-foreground', label: 'Status changed' },
  viewed:          { icon: Eye,          cls: 'text-tertiary',     label: 'Viewed' },
  sent_to_student_vault: { icon: HardDrive, cls: 'text-success',   label: 'Delivered to vault' },
  changes_requested:     { icon: AlertCircle, cls: 'text-warning',  label: 'Changes requested' },
  school_created:  { icon: Building2,    cls: 'text-primary',       label: 'Organisation created' },
  join_request_submitted: { icon: Users, cls: 'text-info',         label: 'Join request submitted' },
  guardian_consent_requested: { icon: Shield, cls: 'text-warning', label: 'Guardian consent requested' },
  role_changed:    { icon: Users,        cls: 'text-primary',       label: 'Role changed' },
  membership_approved:  { icon: CheckCircle2, cls: 'text-success',  label: 'Membership approved' },
  membership_declined:  { icon: XCircle, cls: 'text-destructive',  label: 'Membership declined' },
  membership_invited:   { icon: Send,     cls: 'text-info',         label: 'Invitation sent' },
};

export default function AuditTrail({ logs }) {
  if (!logs?.length) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No history yet.</p>;
  }

  return (
    <div className="space-y-0">
      {logs.map((log, i) => {
        const cfg = ACTION_CONFIG[log.action]
          || { ...ACTION_CONFIG.status_changed, label: String(log.action || 'Event').replace(/_/g, ' ') };
        const Icon = cfg.icon;
        return (
          <div key={log.id} className="flex gap-3 group">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-card border-2 border-border flex items-center justify-center flex-shrink-0 z-10">
                <Icon className={`h-3.5 w-3.5 ${cfg.cls}`} aria-hidden="true" />
              </div>
              {i < logs.length - 1 && <div className="w-0.5 bg-border flex-1 my-0.5" />}
            </div>
            <div className="pb-4 flex-1">
              <p className="text-sm font-medium text-foreground">{cfg.label}</p>
              <p className="text-xs text-muted-foreground">
                {log.actor_name} ({log.actor_role}) — {log.timestamp ? format(new Date(log.timestamp), 'MMM d, yyyy HH:mm') : ''}
              </p>
              {log.notes && <p className="text-xs text-muted-foreground/80 mt-0.5 italic">{log.notes}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}