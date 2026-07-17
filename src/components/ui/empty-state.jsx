import React from "react";
import { cn } from "@/lib/utils";

export default function EmptyState({ icon: Icon, title, description, children, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in", className)}>
      {Icon && (
        <div className="relative mb-5">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
          <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 border border-border flex items-center justify-center shadow-sm">
            <Icon className="h-7 w-7 text-primary" />
          </div>
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">{description}</p>}
      {children && <div className="mt-5 flex items-center gap-3">{children}</div>}
    </div>
  );
}