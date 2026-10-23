import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import AchievementCard, { AchievementRow } from '@/components/achievements/AchievementCard';
import AchievementGridSkeleton from '@/components/achievements/AchievementGridSkeleton';
import EmptyState from '@/components/ui/empty-state';
import { ShieldAlert, Trophy } from 'lucide-react';

/**
 * UnifiedGrid — the responsive achievement grid (1 / 2 / 3 columns) with the
 * compact list alternative. In the All tab with grid view, cards are
 * drag-reorderable; the order persists per card via AchievementMeta.
 * Integrity: a verified card whose fresh chain check FAILED renders a red
 * "Integrity check failed" chip — it never shows as Blockward Verified.
 */
export default function UnifiedGrid({
  items, viewMode = 'grid', loading = false, dndEnabled = false, onDragEnd,
  selectMode = false, selectedRefs, onToggleSelect, onOpen, onShare,
  onGetVerified, onEdit, emptyTitle = 'No achievements here yet',
  emptyDescription, emptyAction = null,
}) {
  if (loading) return <AchievementGridSkeleton />;
  if (!items || items.length === 0) {
    return (
      <EmptyState icon={Trophy} title={emptyTitle} description={emptyDescription}>
        {emptyAction}
      </EmptyState>
    );
  }

  const isSelected = (it) => (selectedRefs || new Set()).has(it.ref);

  const cell = (it, isDragging = false) => (
    <div className={`relative ${isDragging ? 'opacity-90' : ''}`}>
      {selectMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(it.ref); }}
          aria-pressed={isSelected(it)}
          aria-label={isSelected(it) ? 'Deselect' : 'Select'}
          className={`absolute -top-2 -left-2 z-20 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-colors ${
            isSelected(it) ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border-strong hover:border-primary'
          }`}
        >
          {isSelected(it) && <span className="text-xs font-bold">✓</span>}
        </button>
      )}
      <AchievementCard
        item={it.card}
        onClick={() => (selectMode && onToggleSelect ? onToggleSelect(it.ref) : onOpen?.(it))}
        onShare={it.card.verification_id ? onShare : null}
        onGetVerified={it.kind === 'self' ? onGetVerified : null}
        onEdit={it.kind === 'self' ? onEdit : null}
        className={isSelected(it) ? 'ring-2 ring-primary' : ''}
      />
      {it.card.status === 'verified' && it.integrity === 'failed' && (
        <span className="absolute top-9 left-2.5 z-10 inline-flex items-center gap-1 rounded-full border border-destructive/50 bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-red-300">
          <ShieldAlert className="h-2.5 w-2.5" /> Integrity check failed
        </span>
      )}
    </div>
  );

  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.ref} className="relative flex items-center">
            {selectMode && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleSelect?.(it.ref); }}
                aria-pressed={isSelected(it)}
                aria-label={isSelected(it) ? 'Deselect' : 'Select'}
                className={`mr-2 h-6 w-6 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                  isSelected(it) ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border-strong hover:border-primary'
                }`}
              >
                {isSelected(it) && <span className="text-xs font-bold">✓</span>}
              </button>
            )}
            <AchievementRow
              item={it.card}
              onClick={() => (selectMode && onToggleSelect ? onToggleSelect(it.ref) : onOpen?.(it))}
              onShare={it.card.verification_id ? onShare : null}
            />
          </div>
        ))}
      </div>
    );
  }

  if (!dndEnabled) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{items.map((it) => <div key={it.ref}>{cell(it)}</div>)}</div>;
  }

  return (
    <DragDropContext
      onDragEnd={(result) => {
        if (!result.destination || result.destination.index === result.source.index) return;
        const next = [...items];
        const [moved] = next.splice(result.source.index, 1);
        next.splice(result.destination.index, 0, moved);
        onDragEnd?.(next);
      }}
    >
      <Droppable droppableId="ach-grid" direction="horizontal">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((it, i) => (
              <Draggable key={it.ref} draggableId={it.ref} index={i} isDragDisabled={selectMode}>
                {(p, snapshot) => (
                  <div
                    ref={p.innerRef}
                    {...p.draggableProps}
                    {...p.dragHandleProps}
                    style={{ ...p.draggableProps.style, position: snapshot.isDragging ? p.draggableProps.style?.position : 'relative' }}
                  >
                    {cell(it, snapshot.isDragging)}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}