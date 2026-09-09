import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowDownAZ, Shuffle, Move, Undo2, Eraser } from 'lucide-react';

/**
 * ArrangeBar — the three auto-arrange modes as clearly named actions, with an
 * undo for the last arrange so an accidental randomise is recoverable.
 * Shown in Assign mode.
 */
export default function ArrangeBar({ onArrange, onUndo, canUndo, onClearSeats, disabled }) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border bg-card">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Arrange</span>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onArrange('alphabetical')}>
        <ArrowDownAZ className="h-4 w-4" />Alphabetical
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onArrange('random')}>
        <Shuffle className="h-4 w-4" />Randomise
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onArrange('spread')}>
        <Move className="h-4 w-4" />Spread out
      </Button>
      {canUndo && (
        <Button variant="secondary" size="sm" disabled={disabled} onClick={onUndo}>
          <Undo2 className="h-4 w-4" />Undo arrange
        </Button>
      )}
      <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" disabled={disabled} onClick={onClearSeats}>
        <Eraser className="h-4 w-4" />Clear all seats
      </Button>
    </div>
  );
}