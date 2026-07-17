import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

function useCountUp(end, duration = 900) {
  const [count, setCount] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (typeof end !== 'number' || isNaN(end)) {
      setCount(end);
      return;
    }
    const start = 0;
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + (end - start) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [end, duration]);

  return count;
}

export default function StatCard({ label, value, icon: Icon, hint, trend, trendDirection, accentColor, className }) {
  const numericValue = typeof value === 'number' ? value : parseFloat(value);
  const displayValue = useCountUp(numericValue);

  const accent = accentColor || 'primary';

  const accentMap = {
    primary: 'from-primary/20 to-primary/5 text-primary',
    accent: 'from-accent/20 to-accent/5 text-accent',
    blue: 'from-accent-blue/20 to-accent-blue/5 text-accent-blue',
    success: 'from-success/20 to-success/5 text-success',
    warning: 'from-warning/20 to-warning/5 text-warning',
    destructive: 'from-destructive/20 to-destructive/5 text-destructive',
  };

  return (
    <Card className={cn("card-hover overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
              {typeof value === 'number' ? displayValue : value}
            </p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            {trend && (
              <div className={cn(
                "inline-flex items-center gap-1 text-xs font-semibold mt-1",
                trendDirection === 'down' ? 'text-destructive' : 'text-success'
              )}>
                {trendDirection === 'down' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {trend}
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn(
              "h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-sm",
              accentMap[accent] || accentMap.primary
            )}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}