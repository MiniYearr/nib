import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import confetti from 'canvas-confetti';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NibRecord } from '@nib/plugin-api';
import type { ModuleViewProps } from '@nib/shell';
import { MODULE_ID, TASK_TYPE, taskProps } from '../shared';
import {
  addDaysStr,
  applyOccurrenceCompletion,
  applyOccurrenceUncompletion,
  todayStr,
  toggleSimpleTask,
} from '../tasklogic';
import { buildDayModel, type DayItem } from './dayModel';
import { TaskDetail } from './TaskDetail';
import { TaskList } from './TaskList';
import { DAY_START_MINUTES, Timeline } from './Timeline';

const styles = `
.nib-todo { display: flex; flex-direction: column; height: 100%; min-width: 0; }
.nib-todo-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(30, 25, 18, 0.08);
  flex: none;
}
.nib-todo-header button {
  border: 1px solid rgba(30, 25, 18, 0.1);
  background: transparent;
  font: inherit;
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 8px;
  color: #4A443B;
  cursor: default;
}
.nib-todo-header button:hover { background: rgba(30, 25, 18, 0.05); }
.nib-todo-date { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
.nib-todo-toast {
  margin-left: auto;
  background: rgba(110, 139, 106, 0.15);
  color: #4E6B4A;
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 9px;
}
.nib-todo-body { flex: 1; display: flex; min-height: 0; }
.nib-task-list {
  width: 300px;
  flex: none;
  overflow-y: auto;
  padding: 10px 12px 30px;
  border-right: 1px solid rgba(30, 25, 18, 0.08);
}
.nib-task-list-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 4px 6px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #A79F92;
}
.nib-task-list-add {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 11px;
  color: #BF6B44;
  font-weight: 600;
  cursor: default;
}
.nib-task-list-empty { padding: 8px 4px; font-size: 12.5px; color: #A79F92; }
.nib-task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 6px;
  border-radius: 9px;
}
.nib-task-row:hover { background: rgba(30, 25, 18, 0.04); }
.nib-task-row[data-dragging='true'] { opacity: 0.6; position: relative; z-index: 30; }
.nib-task-row input[type='checkbox'] { accent-color: #BF6B44; flex: none; }
.nib-task-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  font: inherit;
  text-align: left;
  padding: 0;
  cursor: default;
}
.nib-task-row-title {
  font-size: 13px;
  color: #26221D;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nib-task-row-title[data-done='true'] { text-decoration: line-through; color: #A79F92; }
.nib-task-row-meta { display: flex; gap: 4px; flex: none; margin-left: auto; }
.nib-task-chip {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: #6B655C;
  background: #F1EDE6;
  border-radius: 5px;
  padding: 2px 5px;
}
.nib-task-chip-streak { color: #4E6B4A; background: rgba(110, 139, 106, 0.16); }
.nib-task-row-grip { color: #C9C2B4; font-size: 11px; cursor: grab; flex: none; padding: 0 2px; }
.nib-timeline { flex: 1; overflow-y: auto; min-width: 0; }
.nib-timeline-inner { position: relative; display: flex; margin: 14px 16px 40px; }
.nib-timeline-gutter { position: relative; width: 46px; flex: none; }
.nib-timeline-gutter span {
  position: absolute;
  transform: translateY(-50%);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: #A79F92;
}
.nib-timeline-canvas { position: relative; flex: 1; }
.nib-timeline-slot {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid rgba(30, 25, 18, 0.05);
}
.nib-timeline-slot[data-hour='true'] { border-top-color: rgba(30, 25, 18, 0.11); }
.nib-timeline-slot[data-over='true'] { background: rgba(191, 107, 68, 0.1); }
.nib-timeline-block {
  position: absolute;
  left: 6px;
  right: 10px;
  background: rgba(191, 107, 68, 0.14);
  border: 1px solid rgba(191, 107, 68, 0.4);
  border-left: 3px solid #BF6B44;
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  color: #26221D;
  overflow: hidden;
  display: flex;
  gap: 6px;
  align-items: flex-start;
  cursor: grab;
  z-index: 10;
}
.nib-timeline-block[data-done='true'] { opacity: 0.55; }
.nib-timeline-block[data-dragging='true'] { z-index: 40; box-shadow: 0 10px 24px -8px rgba(50, 38, 24, 0.4); }
.nib-timeline-block-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nib-timeline-block-recur { margin-left: auto; color: #8C4F33; font-size: 11px; }
.nib-task-detail {
  width: 300px;
  flex: none;
  border-left: 1px solid rgba(30, 25, 18, 0.08);
  background: #F7F3EB;
  overflow-y: auto;
  padding: 0 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.nib-task-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0 0;
  font-size: 12.5px;
  font-weight: 700;
}
.nib-task-detail-header button { border: none; background: transparent; font-size: 15px; color: #8A8171; cursor: default; }
.nib-task-detail-title {
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  color: #26221D;
}
.nib-task-detail-notes {
  border: 1px solid rgba(30, 25, 18, 0.1);
  border-radius: 9px;
  background: #FBFAF7;
  font: inherit;
  font-size: 12.5px;
  padding: 8px 10px;
  min-height: 64px;
  resize: vertical;
  outline: none;
  color: #26221D;
}
.nib-task-detail-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #6B655C; }
.nib-task-detail-field > span { font-weight: 600; }
.nib-task-detail-field input, .nib-task-detail-field select {
  font: inherit;
  font-size: 12.5px;
  border: 1px solid rgba(30, 25, 18, 0.1);
  border-radius: 7px;
  background: #FBFAF7;
  padding: 5px 8px;
  color: #26221D;
}
.nib-task-detail-habit { flex-direction: row; align-items: center; }
.nib-task-detail-habit input { accent-color: #6E8B6A; }
.nib-task-detail-streak { margin-left: auto; font-size: 12px; color: #4E6B4A; font-weight: 700; }
.nib-task-detail-subtasks { display: flex; flex-direction: column; gap: 4px; }
.nib-task-detail-subtask { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: #26221D; }
.nib-task-detail-subtask input { accent-color: #BF6B44; }
.nib-task-detail-subtask span[data-done='true'] { text-decoration: line-through; color: #A79F92; }
.nib-task-detail-subtask button { border: none; background: transparent; color: #C9C2B4; margin-left: auto; cursor: default; }
.nib-task-detail-subtask button:hover { color: #26221D; }
.nib-task-detail-subtask-input {
  border: none !important;
  background: transparent !important;
  outline: none;
  font-size: 12.5px;
  padding: 3px 0 !important;
}
.nib-task-detail-delete {
  margin-top: 8px;
  border: 1px solid rgba(191, 68, 68, 0.35);
  background: transparent;
  color: #A54D3B;
  font: inherit;
  font-size: 12px;
  padding: 7px 0;
  border-radius: 8px;
  cursor: default;
}
.nib-task-detail-delete:hover { background: rgba(191, 68, 68, 0.08); }
.nib-recur { display: flex; flex-direction: column; gap: 6px; }
.nib-recur-row { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #6B655C; }
.nib-recur-row input[type='number'] { width: 54px; }
.nib-recur-day {
  border: 1px solid rgba(30, 25, 18, 0.12);
  background: #FBFAF7;
  font: inherit;
  font-size: 10.5px;
  padding: 4px 6px;
  border-radius: 6px;
  color: #6B655C;
  cursor: default;
}
.nib-recur-day[data-active='true'] { background: rgba(191, 107, 68, 0.16); color: #8C4F33; border-color: rgba(191, 107, 68, 0.4); font-weight: 700; }
.nib-recur-text { font-size: 11.5px; color: #8A8171; font-style: italic; }
`;

const CONFETTI_COLORS = ['#BF6B44', '#6E8B6A', '#E4B363', '#8A6BC8', '#FBFAF7'];

export function TodoView({ openRequest }: ModuleViewProps) {
  const [tasks, setTasks] = useState<NibRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [detailId, setDetailId] = useState<string>();
  const [toast, setToast] = useState<string>();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const refresh = useCallback(() => {
    if (!window.nib) return;
    void window.nib.records.list({ type: TASK_TYPE, limit: 1000 }).then(setTasks);
  }, []);

  useEffect(() => {
    refresh();
    if (!window.nib) return;
    return window.nib.events.on('record.*', (event) => {
      const payload = event.payload as { record?: NibRecord };
      if (!payload.record || payload.record.type === TASK_TYPE) refresh();
    });
  }, [refresh]);

  useEffect(() => {
    if (openRequest) {
      setDetailId(openRequest.record.id);
    }
  }, [openRequest]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(undefined), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const model = useMemo(() => buildDayModel(tasks, selectedDate), [tasks, selectedDate]);
  const detailTask = tasks.find((task) => task.id === detailId);

  const updateProps = useCallback(
    async (task: NibRecord, props: NibRecord['props']) => {
      if (!window.nib) return;
      await window.nib.records.update(MODULE_ID, task.id, { props });
      refresh();
    },
    [refresh],
  );

  const toggle = useCallback(
    (item: DayItem, done: boolean) => {
      const today = todayStr();
      if (item.occurrence) {
        if (done) {
          const result = applyOccurrenceCompletion(item.props, selectedDate, today);
          void updateProps(item.task, result.props as unknown as NibRecord['props']);
          if (result.milestone) {
            void confetti({
              particleCount: 140,
              spread: 80,
              origin: { y: 0.75 },
              colors: CONFETTI_COLORS,
            });
            setToast(`🔥 ${result.milestone}-day streak on "${item.task.title}"!`);
            window.nib?.events.emit(MODULE_ID, `${MODULE_ID}.milestone`, {
              taskId: item.task.id,
              title: item.task.title,
              streak: result.milestone,
            });
          }
        } else {
          const next = applyOccurrenceUncompletion(item.props, selectedDate, today);
          void updateProps(item.task, next as unknown as NibRecord['props']);
        }
      } else {
        const next = toggleSimpleTask(item.props, done, Date.now());
        void updateProps(item.task, next as unknown as NibRecord['props']);
      }
    },
    [selectedDate, updateProps],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id);
      const overId = event.over ? String(event.over.id) : undefined;
      const taskId = activeId.replace(/^(task|block):/, '');
      const task = tasks.find((candidate) => candidate.id === taskId);
      if (!task || !overId) return;
      const props = taskProps(task);

      if (overId === 'list-pane') {
        void updateProps(task, { ...task.props, scheduled: undefined });
        return;
      }
      if (overId.startsWith('slot:')) {
        const startMinutes = Number(overId.slice(5));
        void updateProps(task, {
          ...task.props,
          scheduled: {
            date: props.recurrence ? undefined : selectedDate,
            startMinutes: Math.max(DAY_START_MINUTES, startMinutes),
            durationMinutes: props.scheduled?.durationMinutes ?? 60,
          },
        });
      }
    },
    [tasks, selectedDate, updateProps],
  );

  const newTask = async () => {
    if (!window.nib) return;
    const record = await window.nib.records.create(MODULE_ID, {
      type: TASK_TYPE,
      title: 'New task',
      props: { status: 'open', dueDate: selectedDate },
    });
    setDetailId(record.id);
    refresh();
  };

  const today = todayStr();
  const dateLabel =
    selectedDate === today
      ? 'Today'
      : new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });

  return (
    <div className="nib-todo">
      <style>{styles}</style>
      <div className="nib-todo-header">
        <button onClick={() => setSelectedDate(addDaysStr(selectedDate, -1))}>‹</button>
        <span className="nib-todo-date">
          {dateLabel}
          {selectedDate !== today && (
            <>
              {' '}
              <button onClick={() => setSelectedDate(today)}>Today</button>
            </>
          )}
        </span>
        <button onClick={() => setSelectedDate(addDaysStr(selectedDate, 1))}>›</button>
        {toast && <span className="nib-todo-toast">{toast}</span>}
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="nib-todo-body">
          <TaskList
            dayItems={model.dayItems}
            inbox={model.inbox}
            dateLabel={dateLabel}
            onToggle={toggle}
            onOpen={(task) => setDetailId(task.id)}
            onNewTask={() => void newTask()}
          />
          <Timeline blocks={model.blocks} onOpen={(task) => setDetailId(task.id)} />
          {detailTask && (
            <TaskDetail
              task={detailTask}
              onClose={() => setDetailId(undefined)}
              onChanged={refresh}
              onDeleted={() => {
                setDetailId(undefined);
                refresh();
              }}
            />
          )}
        </div>
      </DndContext>
    </div>
  );
}
