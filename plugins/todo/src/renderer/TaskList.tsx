import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { NibRecord } from '@nib/plugin-api';
import { Icon } from '@nib/shell';
import { isRecurring, taskProps, type TaskProps } from '../shared';
import { addDaysStr, describeRecurrence, todayStr } from '../tasklogic';
import type { DayItem } from './dayModel';

function capitalize(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function weekStrip(props: TaskProps): boolean[] {
  const done = new Set(props.completions ?? []);
  const today = todayStr();
  return Array.from({ length: 7 }, (_, i) => done.has(addDaysStr(today, -(6 - i))));
}

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
  const recurring = isRecurring(props);

  return (
    <div
      ref={setNodeRef}
      className="nib-task-card"
      data-dragging={isDragging}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
    >
      <input
        type="checkbox"
        className="nib-task-check"
        checked={item.done}
        onChange={(event) => onToggle(item, event.target.checked)}
      />
      <button className="nib-task-body" onClick={() => onOpen(item.task)}>
        <span className="nib-task-title" data-done={item.done}>
          {item.task.title || 'Untitled task'}
        </span>
        <span className="nib-task-chips">
          {recurring && (
            <span className="nib-task-chip">
              <Icon name="repeat" size={11} />
              {capitalize(describeRecurrence(props.recurrence!, props.recurrenceAnchor!))}
            </span>
          )}
          {props.habit && props.streak && props.streak.current > 0 && (
            <span className="nib-task-chip nib-task-chip-streak">
              <Icon name="flame" size={11} />
              {props.streak.current}
            </span>
          )}
          {props.scheduled?.startMinutes !== undefined && (
            <span className="nib-task-chip nib-task-chip-due">
              {minutesToTime(props.scheduled.startMinutes)}
            </span>
          )}
        </span>
        {subtasks.length > 0 && (
          <span className="nib-task-progress">
            <span className="nib-task-progress-bar">
              <span style={{ width: `${(doneCount / subtasks.length) * 100}%` }} />
            </span>
            <span className="nib-task-progress-count">
              {doneCount} / {subtasks.length}
            </span>
          </span>
        )}
        {props.habit && (
          <span className="nib-task-week">
            {weekStrip(props).map((filled, i) => (
              <span key={i} data-filled={filled} />
            ))}
          </span>
        )}
      </button>
      <span className="nib-task-grip" {...listeners} {...attributes} title="Drag to schedule">
        <Icon name="grip-vertical" size={14} />
      </span>
    </div>
  );
}

export interface TaskListProps {
  dayItems: DayItem[];
  inbox: DayItem[];
  width: number | string;
  onToggle(item: DayItem, done: boolean): void;
  onOpen(task: NibRecord): void;
  onNewTask(): void;
}

export function TaskList({ dayItems, inbox, width, onToggle, onOpen, onNewTask }: TaskListProps) {
  const { setNodeRef } = useDroppable({ id: 'list-pane' });
  const openCount = dayItems.filter((item) => !item.done).length;

  return (
    <div ref={setNodeRef} className="nib-task-list" style={{ width }}>
      <div className="nib-task-list-section">
        <span>Today · {openCount} left</span>
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

      <button className="nib-task-add" onClick={onNewTask}>
        <Icon name="plus" size={15} />
        Add task
      </button>
    </div>
  );
}
