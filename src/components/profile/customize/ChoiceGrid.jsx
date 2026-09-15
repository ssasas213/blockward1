import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Generic bounded-preset picker — every option is a designed choice,
// never raw styling. Optional `preview` renders a small visual per option.
export default function ChoiceGrid({ options, value, onChange, columns = 3, preview }) {
  return (
    <div className={cn(
      'grid gap-2',
      columns === 2 && 'grid-cols-2',
      columns === 3 && 'grid-cols-3',
      columns === 4 && 'grid-cols-2 sm:grid-cols-4',
    )}>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={selected}
            className={cn(
              'relative rounded-lg border p-2.5 text-left transition-colors',
              selected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/40',
            )}
          >
            {preview?.(o)}
            <p className="text-xs font-semibold text-foreground">{o.label}</p>
            {o.desc && <p className="text-[10px] leading-tight text-muted-foreground mt-0.5">{o.desc}</p>}
            {selected && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                <Check className="h-2.5 w-2.5 text-primary-foreground" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}