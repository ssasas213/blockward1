import React from "react";
import { cn } from "@/lib/utils";

// Shared empty state: explains what is missing, why, and what to do next.
// `hint` is an optional small line under the actions (e.g. why the user sees this).
export default function EmptyState({ icon: Icon, title, description, hint, children, className }) {
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center py-14 px-4 text-center animate-fade-in", className)}>
      {Icon && (
        <div className="mb-4 h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
      )}
      <h3 className="section-heading">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">{description}</p>}
      {children && <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{children}</div>}
      {hint && <p className="caption mt-4 max-w-md">{hint}</p>}
    </div>
  );
}