import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import PortfolioCard, { PortfolioRow } from './PortfolioCard';
import AchievementGridSkeleton from '@/components/achievements/AchievementGridSkeleton';
import EmptyState from '@/components/ui/empty-state';
import { Trophy } from 'lucide-react';

/**
 * PortfolioGrid — the dashboard's responsive achievement grid: three columns
 * on desktop, two on tablet, one on phones, with a compact list alternative.
 * In grid view (All tab, no selection) cards are drag-reorderable and the
 * order persists via AchievementMeta.
 */
export default function PortfolioGrid({
  items, viewMode = 'grid', loading = false, dndEnabled = false, onDragEnd,
  selectMode = false, selectedRefs, onToggleSelect, onOpen,
  bannerOf, catsOf, featuredOf, menuActionsOf,
  onGetVerified, onEdit,
  emptyTitle = 'No achievements here yet', emptyDescription, emptyAction = null,
}) {
  if (loading) return <AchievementGridSkeleton />;
  if (!items || items.length === 0) {
    return (
      <EmptyState icon={Trophy} title={emptyTitle} description={emptyDescription}>
        {emptyAction}
      </EmptyState>
    );
  }

  const bannerOfSafe = (it) => (bannerOf ? bannerOf(it) : null) || it.card.cover || null;
  const isSelected = (it) => (selectedRefs || new Set()).has(it.ref);

  const cell = (it) => (
    <div className="relative">
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
      <PortfolioCard
        it={it}
        banner={bannerOfSafe(it)}
        categories={catsOf ? catsOf(it) : []}
        featured={featuredOf ? featuredOf(it) : false}
        menuActions={menuActionsOf ? menuActionsOf(it) : []}
        onOpen={onOpen}
        onGetVerified={it.kind === 'self' ? onGetVerified : null}
        onEdit={it.kind === 'self' ? onEdit : null}
        className={isSelected(it) ? 'ring-2 ring-primary' : ''}
      />
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
            <PortfolioRow
              it={it}
              banner={bannerOfSafe(it)}
              featured={featuredOf ? featuredOf(it) : false}
              menuActions={menuActionsOf ? menuActionsOf(it) : []}
              onOpen={onOpen}
            />
          </div>
        ))}
      </div>
    );
  }

  if (!dndEnabled) {
    return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((it) => <div key={it.ref}>{cell(it)}</div>)}</div>;
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
      <Droppable droppableId="pf-grid" direction="horizontal">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((it, i) => (
              <Draggable key={it.ref} draggableId={it.ref} index={i} isDragDisabled={selectMode}>
                {(p, snapshot) => (
                  <div
                    ref={p.innerRef}
                    {...p.draggableProps}
                    {...p.dragHandleProps}
                    style={{ ...p.draggableProps.style, position: snapshot.isDragging ? p.draggableProps.style?.position : 'relative' }}
                  >
                    {cell(it)}
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