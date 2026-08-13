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

const ACCENT_TEXT = {
  primary: 'text-primary',
  accent: 'text-accent',
  blue: 'text-accent-blue',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

export default function StatCard({ label, value, icon: Icon, hint, trend, trendDirection, accentColor, className }) {
  const numericValue = typeof value === 'number' ? value : parseFloat(value);
  const displayValue = useCountUp(numericValue);
  const accent = ACCENT_TEXT[accentColor || 'primary'] || ACCENT_TEXT.primary;

  return (
    <Card className={cn("card-hover overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
              {typeof value === 'number' ? displayValue : value}
            </p>
            {hint && <p className="text-xs text-tertiary">{hint}</p>}
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
              "h-10 w-10 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0",
              accent
            )}>
              <Icon className="h-[18px] w-[18px]" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}