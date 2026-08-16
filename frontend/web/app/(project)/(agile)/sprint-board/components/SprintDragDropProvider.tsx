'use client';

import React, { ReactNode } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { SprintboardTask, Sprintcolumn } from '../types';
import SprintCard from './SprintCard';

interface SprintDragDropProviderProps {
  children: ReactNode;
  tasks: SprintboardTask[];
  columns?: Sprintcolumn[];
  onDragEnd: (event: DragEndEvent) => void;
}

export default function SprintDragDropProvider({
  children,
  tasks,
  columns = [],
  onDragEnd,
}: SprintDragDropProviderProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  const [draggedTask, setDraggedTask] = React.useState<SprintboardTask | null>(null);
  const [draggedColumn, setDraggedColumn] = React.useState<Sprintcolumn | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeIdStr = active.id.toString();
    if (activeIdStr.startsWith('column-')) {
      const colId = Number(activeIdStr.replace('column-', ''));
      const col = columns.find((c) => c.id === colId);
      if (col) {
        setDraggedColumn(col);
      }
      return;
    }
    const task = tasks.find((t) => t.taskId.toString() === activeIdStr);
    if (task) {
      setDraggedTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedTask(null);
    setDraggedColumn(null);
    onDragEnd(event);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay>
        {draggedTask ? (
          <div className="pointer-events-none scale-[1.03] opacity-95 shadow-cu-xl">
            <SprintCard task={draggedTask} />
          </div>
        ) : draggedColumn ? (
          <div className="pointer-events-none w-72 rounded-xl border border-cu-primary/40 bg-cu-bg p-3 shadow-cu-xl opacity-90">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-cu-primary">
              {draggedColumn.columnName}
            </h3>
            <p className="text-[11px] text-cu-text-muted mt-1">
              {draggedColumn.tasks?.length ?? 0} tasks
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
