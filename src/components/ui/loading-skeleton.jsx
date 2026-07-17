import React from "react";
import { cn } from "@/lib/utils";

const Skeleton = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("shimmer rounded-lg bg-secondary/60", className)}
    {...props}
  />
));
Skeleton.displayName = "Skeleton";

function CardSkeleton({ className }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card/60 p-6 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

function TableSkeleton({ rows = 5, className }) {
  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", className)}>
      <div className="bg-secondary/40 px-4 py-3 flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3.5 flex gap-4 border-t border-border">
          {Array.from({ length: 4 }).map((_, j) => (
            <Skeleton key={j} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton({ className }) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export { Skeleton, CardSkeleton, TableSkeleton, DashboardSkeleton };