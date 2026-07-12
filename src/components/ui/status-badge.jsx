import React from "react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-600" },
  submitted: { label: "Submitted", className: "bg-blue-100 text-blue-700" },
  awaiting_teacher_signature: { label: "Awaiting Teacher Signature", className: "bg-amber-100 text-amber-700" },
  awaiting_admin_signature: { label: "Awaiting Admin Approval", className: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  minted: { label: "Ready for Vault", className: "bg-indigo-100 text-indigo-700" },
  archived: { label: "Archived", className: "bg-slate-100 text-slate-600" },
  delivered_to_vault: { label: "Delivered to Vault", className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700" },
  revoked: { label: "Revoked", className: "bg-red-100 text-red-700" },
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700" },
  pending_approval: { label: "Pending Approval", className: "bg-amber-100 text-amber-700" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-700" },
  inactive: { label: "Inactive", className: "bg-slate-100 text-slate-600" },
};

export default function StatusBadge({ status, className }) {
  const config = STATUS_CONFIG[status] || { label: status, className: "bg-slate-100 text-slate-600" };
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