import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { PROFILE_SECTIONS, DEFAULT_SECTION_ORDER } from '@/lib/profileThemes';

// The Sections tab — drag to reorder the page's sections, and hide any of
// them individually. A hidden section never renders, not shown empty.
export default function SectionsSection({ value, set }) {
  const order = Array.isArray(value.section_order) && value.section_order.length === DEFAULT_SECTION_ORDER.length
    ? value.section_order
    : DEFAULT_SECTION_ORDER;
  const vis = value.section_visibility || {};
  const visible = (id) => vis[id] !== false;

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const next = [...order];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    set({ section_order: next });
  };

  const toggle = (id) => set({ section_visibility: { ...vis, [id]: !visible(id) } });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Section order</p>
        <p className="text-xs text-muted-foreground">Drag to reorder the sections of your public profile.</p>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="sections">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {order.map((id, index) => {
                const meta = PROFILE_SECTIONS.find((s) => s.id === id);
                if (!meta) return null;
                const on = visible(id);
                return (
                  <Draggable key={id} draggableId={id} index={index}>
                    {(drag) => (
                      <div
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        className={`flex items-center gap-3 rounded-lg border border-border bg-background p-3 ${on ? '' : 'opacity-60'}`}
                      >
                        <span {...drag.dragHandleProps} className="cursor-grab text-muted-foreground flex-shrink-0" aria-label="Drag to reorder">
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{meta.label}</p>
                          <p className="text-xs text-muted-foreground">{meta.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggle(id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-hover flex-shrink-0"
                          aria-label={on ? `Hide ${meta.label}` : `Show ${meta.label}`}
                          title={on ? 'Visible — click to hide' : 'Hidden — click to show'}
                        >
                          {on ? <Eye className="h-4 w-4 text-success" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                        </button>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <p className="text-xs text-muted-foreground">A hidden section never renders on your page — it isn't shown empty.</p>
    </div>
  );
}