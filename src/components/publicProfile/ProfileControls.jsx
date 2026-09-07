import React from 'react';
import { DOMAIN_ORDER, DOMAIN_LABELS } from '@/lib/achievementDomains';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LayoutGrid, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ProfileControls — category filter chips (each with its own count),
 * sort control (date / category / endorsements) and the Grid ⇄ Timeline
 * view toggle for the public profile.
 */
export default function ProfileControls({ counts, chip, setChip, sort, setSort, view, setView }) {
  // 'Other' only appears when something actually falls into it.
  const chips = ['all', ...DOMAIN_ORDER.filter((d) => d !== 'other' || (counts.other || 0) > 0)];

  return (
    <div className="flex flex-wrap items-center gap-2 mt-8 mb-5">
      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
        {chips.map((d) => {
          const count = counts[d] || 0;
          return (
            <button
              key={d}
              onClick={() => setChip(d)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-150',
                chip === d
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
              )}
            >
              {d === 'all' ? 'All' : DOMAIN_LABELS[d] || d}
              {count > 0 && <span className={cn('ml-1', chip === d ? 'text-primary-foreground/80' : 'text-tertiary')}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Sort */}
      <Select value={sort} onValueChange={setSort}>
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="endorsements">Most endorsed</SelectItem>
          <SelectItem value="date">Most recent</SelectItem>
          <SelectItem value="category">By category</SelectItem>
        </SelectContent>
      </Select>

      {/* View toggle */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setView('grid')}
          className={cn('p-2 transition-colors', view === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
          aria-label="Grid view"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          onClick={() => setView('timeline')}
          className={cn('p-2 transition-colors', view === 'timeline' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
          aria-label="Timeline view"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}