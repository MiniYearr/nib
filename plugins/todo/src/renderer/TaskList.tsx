import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { NibRecord } from '@nib/plugin-api';
import { taskProps } from '../shared';
import type { DayItem } from './dayModel';

function TaskRow({
  item,
  onToggle,
  onOpen,
}: {
  item: DayItem;
  onToggle(item: DayItem, done: boolean): void;
  onOpen(task: NibRecord): void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task:${item.task.id}`,
  });
  const props = taskProps(item.task);
  const subtasks = props.subtasks ?? [];
  const doneCount = subtasks.filter((subtask) => subtask.done).length;

  return (
    <div
      ref={setNodeRef}
      className="nib-task-row"
      data-dragging={isDragging}
      style={
        transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined
      }
    >
      <input
        type="checkbox"
        checked={item.done}
        onChange={(event) => onToggle(item, event.target.checked)}
      />
      <button className="nib-task-row-main" onClick={() => onOpen(item.task)}>
        <span className="nib-task-row-title" data-done={item.done}>
          {item.task.title || 'Untitled task'}
        </span>
        <span className="nib-task-row-meta">
          {props.habit && props.streak && props.streak.current > 0 && (
            <span className="nib-task-chip nib-task-chip-streak">🔥 {props.streak.current}</span>
          )}
          {item.occurrence && <span className="nib-task-chip">↻</span>}
          {subtasks.length > 0 && (
            <span className="nib-task-chip">
              {doneCount}/{subtasks.length}
            </span>
          )}
        </span>
      </button>
      <span className="nib-task-row-grip" {...listeners} {...attributes} title="Drag to schedule">
        ⋮⋮
      </span>
    </div>
  );
}

export interface TaskListProps {
  dayItems: DayItem[];
  inbox: DayItem[];
  dateLabel: string;
  onToggle(item: DayItem, done: boolean): void;
  onOpen(task: NibRecord): void;
  onNewTask(): void;
}

export function TaskList({ dayItems, inbox, dateLabel, onToggle, onOpen, onNewTask }: TaskListProps) {
  const { setNodeRef } = useDroppable({ id: 'list-pane' });

  return (
    <div ref={setNodeRef} className="nib-task-list">
      <div className="nib-task-list-section">
        <span>{dateLabel}</span>
        <button className="nib-task-list-add" onClick={onNewTask}>
          + task
        </button>
      </div>
      {dayItems.length === 0 && <div className="nib-task-list-empty">Nothing for this day</div>}
      {dayItems.map((item) => (
        <TaskRow key={item.key} item={item} onToggle={onToggle} onOpen={onOpen} />
      ))}

      {inbox.length > 0 && (
        <>
          <div className="nib-task-list-section">
            <span>Inbox</span>
          </div>
          {inbox.map((item) => (
            <TaskRow key={item.key} item={item} onToggle={onToggle} onOpen={onOpen} />
          ))}
        </>
      )}
    </div>
  );
}
