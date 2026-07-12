import React from "react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  submitted: { label: "Submitted", className: "bg-primary/10 text-primary" },
  awaiting_teacher_signature: { label: "Awaiting Teacher Signature", className: "bg-warning/10 text-warning" },
  awaiting_admin_signature: { label: "Awaiting Admin Approval", className: "bg-warning/10 text-warning" },
  approved: { label: "Approved", className: "bg-success/10 text-success" },
  minted: { label: "Ready for Vault", className: "bg-primary/10 text-primary" },
  archived: { label: "Archived", className: "bg-muted text-muted-foreground" },
  delivered_to_vault: { label: "Delivered to Vault", className: "bg-success/10 text-success" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive" },
  active: { label: "Active", className: "bg-success/10 text-success" },
  revoked: { label: "Revoked", className: "bg-destructive/10 text-destructive" },
  pending: { label: "Pending", className: "bg-warning/10 text-warning" },
  pending_approval: { label: "Pending Approval", className: "bg-warning/10 text-warning" },
  suspended: { label: "Suspended", className: "bg-destructive/10 text-destructive" },
  inactive: { label: "Inactive", className: "bg-muted text-muted-foreground" },
};

export default function StatusBadge({ status, className }) {
  const config = STATUS_CONFIG[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}