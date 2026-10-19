import React from "react";
import { cn } from "@/lib/utils";

export default function PageHeader({ title, description, children, className }) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 mb-6 border-b border-border", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3 flex-shrink-0">{children}</div>}
    </div>
  );
}