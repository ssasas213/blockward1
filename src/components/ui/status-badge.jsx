import React from "react";
import { cn } from "@/lib/utils";

// Single canonical status → colour map used everywhere.
// draft = grey · waiting = purple · changes = amber · approved = blue · delivered/verified = green · rejected = red
const STATUS_CONFIG = {
  draft: { label: "Draft", tone: "muted", dot: "bg-muted-foreground" },
  submitted: { label: "Submitted", tone: "primary", dot: "bg-primary" },

  awaiting_teacher_signature: { label: "Waiting for Teacher", tone: "primary", dot: "bg-primary" },
  awaiting_admin_signature: { label: "Waiting for Administrator", tone: "primary", dot: "bg-primary" },

  changes_requested: { label: "Changes Requested", tone: "warning", dot: "bg-warning" },

  approved: { label: "Approved", tone: "primary", dot: "bg-primary" },
  delivering: { label: "Delivering…", tone: "primary", dot: "bg-primary animate-pulse" },

  delivered_to_vault: { label: "Delivered", tone: "success", dot: "bg-success" },
  verified: { label: "Verified", tone: "success", dot: "bg-success" },

  minted: { label: "Ready for Vault", tone: "primary", dot: "bg-primary" },
  archived: { label: "Archived", tone: "muted", dot: "bg-muted-foreground" },
  rejected: { label: "Rejected", tone: "destructive", dot: "bg-destructive" },

  active: { label: "Active", tone: "success", dot: "bg-success" },
  revoked: { label: "Revoked", tone: "destructive", dot: "bg-destructive" },
  pending: { label: "Pending", tone: "warning", dot: "bg-warning" },
  pending_approval: { label: "Pending Approval", tone: "warning", dot: "bg-warning" },
  suspended: { label: "Suspended", tone: "destructive", dot: "bg-destructive" },
  inactive: { label: "Inactive", tone: "muted", dot: "bg-muted-foreground" },
};

const TONE_CLASS = {
  muted: "bg-muted/60 text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/15",
  warning: "bg-warning/10 text-warning border-warning/20",
  info: "bg-info/10 text-info border-info/20",
  success: "bg-success/10 text-success border-success/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function StatusBadge({ status, className, label }) {
  const config = STATUS_CONFIG[status] || { label: label || status, tone: "muted", dot: "bg-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border",
        TONE_CLASS[config.tone],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", config.dot)} />
      {label || config.label}
    </span>
  );
}