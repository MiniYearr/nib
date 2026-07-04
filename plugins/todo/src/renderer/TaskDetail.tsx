import { useEffect, useState } from 'react';
import type { NibRecord } from '@nib/plugin-api';
import { MODULE_ID, taskProps, type Subtask, type TaskProps } from '../shared';
import { RecurrenceEditor } from './RecurrenceEditor';

export interface TaskDetailProps {
  task: NibRecord;
  onClose(): void;
  onChanged(record: NibRecord): void;
  onDeleted(id: string): void;
}

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function TaskDetail({ task, onClose, onChanged, onDeleted }: TaskDetailProps) {
  const props = taskProps(task);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.bodyMd);
  const [subtaskDraft, setSubtaskDraft] = useState('');

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.bodyMd);
  }, [task.id, task.title, task.bodyMd]);

  const save = async (patch: { title?: string; bodyMd?: string; props?: TaskProps }) => {
    if (!window.nib) return;
    const updated = await window.nib.records.update(MODULE_ID, task.id, {
      title: patch.title,
      bodyMd: patch.bodyMd,
      props: patch.props as unknown as Record<string, unknown> | undefined,
    });
    onChanged(updated);
  };

  const saveProps = (mutate: (current: TaskProps) => TaskProps) =>
    save({ props: mutate(taskProps(task)) });

  const changeSubtasks = (subtasks: Subtask[]) => void saveProps((p) => ({ ...p, subtasks }));

  const addSubtask = () => {
    const text = subtaskDraft.trim();
    if (!text) return;
    setSubtaskDraft('');
    changeSubtasks([
      ...(props.subtasks ?? []),
      { id: crypto.randomUUID(), title: text, done: false },
    ]);
  };

  const remove = async () => {
    if (!window.nib) return;
    await window.nib.records.softDelete(MODULE_ID, task.id);
    onDeleted(task.id);
  };

  return (
    <aside className="nib-task-detail">
      <div className="nib-task-detail-header">
        <span>Task</span>
        <button onClick={onClose}>×</button>
      </div>

      <input
        className="nib-task-detail-title"
        placeholder="Task title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => title !== task.title && void save({ title })}
      />

      <textarea
        className="nib-task-detail-notes"
        placeholder="Notes…"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        onBlur={() => notes !== task.bodyMd && void save({ bodyMd: notes })}
      />

      <label className="nib-task-detail-field">
        <span>Due</span>
        <input
          type="date"
          value={props.dueDate ?? ''}
          onChange={(event) =>
            void saveProps((p) => ({ ...p, dueDate: event.target.value || undefined }))
          }
        />
      </label>

      <label className="nib-task-detail-field">
        <span>Time block</span>
        <input
          type="time"
          value={props.scheduled ? minutesToTime(props.scheduled.startMinutes) : ''}
          onChange={(event) => {
            const time = event.target.value;
            void saveProps((p) => ({
              ...p,
              scheduled: time
                ? {
                    date: p.recurrence ? undefined : (p.scheduled?.date ?? p.dueDate),
                    startMinutes: timeToMinutes(time),
                    durationMinutes: p.scheduled?.durationMinutes ?? 60,
                  }
                : undefined,
            }));
          }}
        />
        {props.scheduled && (
          <select
            value={props.scheduled.durationMinutes}
            onChange={(event) =>
              void saveProps((p) => ({
                ...p,
                scheduled: p.scheduled && {
                  ...p.scheduled,
                  durationMinutes: Number(event.target.value),
                },
              }))
            }
          >
            {[30, 60, 90, 120, 180, 240].map((duration) => (
              <option key={duration} value={duration}>
                {duration} min
              </option>
            ))}
          </select>
        )}
      </label>

      <div className="nib-task-detail-field">
        <span>Repeats</span>
        <RecurrenceEditor
          value={{ recurrence: props.recurrence, recurrenceAnchor: props.recurrenceAnchor }}
          onChange={(value) =>
            void saveProps((p) => ({
              ...p,
              recurrence: value.recurrence,
              recurrenceAnchor: value.recurrenceAnchor,
              habit: value.recurrence ? p.habit : false,
              streak: value.recurrence ? p.streak : undefined,
            }))
          }
        />
      </div>

      {props.recurrence && (
        <label className="nib-task-detail-field nib-task-detail-habit">
          <input
            type="checkbox"
            checked={props.habit ?? false}
            onChange={(event) =>
              void saveProps((p) => ({
                ...p,
                habit: event.target.checked,
                streak: event.target.checked ? (p.streak ?? { current: 0, best: 0 }) : undefined,
              }))
            }
          />
          <span>Track as habit (streaks)</span>
          {props.habit && props.streak && (
            <span className="nib-task-detail-streak">
              🔥 {props.streak.current} · best {props.streak.best}
            </span>
          )}
        </label>
      )}

      <div className="nib-task-detail-field">
        <span>Subtasks</span>
        <div className="nib-task-detail-subtasks">
          {(props.subtasks ?? []).map((subtask) => (
            <label key={subtask.id} className="nib-task-detail-subtask">
              <input
                type="checkbox"
                checked={subtask.done}
                onChange={(event) =>
                  changeSubtasks(
                    (props.subtasks ?? []).map((item) =>
                      item.id === subtask.id ? { ...item, done: event.target.checked } : item,
                    ),
                  )
                }
              />
              <span data-done={subtask.done}>{subtask.title}</span>
              <button
                onClick={() =>
                  changeSubtasks((props.subtasks ?? []).filter((item) => item.id !== subtask.id))
                }
              >
                ×
              </button>
            </label>
          ))}
          <input
            className="nib-task-detail-subtask-input"
            placeholder="+ subtask"
            value={subtaskDraft}
            onChange={(event) => setSubtaskDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addSubtask();
              }
            }}
          />
        </div>
      </div>

      <button className="nib-task-detail-delete" onClick={() => void remove()}>
        Delete task
      </button>
    </aside>
  );
}
