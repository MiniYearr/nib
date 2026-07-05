import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import confetti from 'canvas-confetti';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NibRecord } from '@nib/plugin-api';
import { Icon, type ModuleViewProps } from '@nib/shell';
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
  border-bottom: 1px solid var(--nib-border);
  flex: none;
}
.nib-todo-header button {
  border: 1px solid var(--nib-border-strong);
  background: transparent;
  font: inherit;
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 8px;
  color: var(--nib-ink-2);
  cursor: default;
}
.nib-todo-header button:hover { background: var(--nib-border); }
.nib-todo-date { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
.nib-todo-toast {
  margin-left: auto;
  background: rgba(110, 139, 106, 0.15);
  color: var(--nib-streak-ink);
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 9px;
}
.nib-todo-planbanner {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 0;
  padding: 11px 18px;
  background: var(--nib-accent-soft);
  border-bottom: 1px solid var(--nib-border);
  font-size: 13px;
  line-height: 1.5;
  color: var(--nib-ink);
  white-space: pre-wrap;
  flex: none;
  max-height: 180px;
  overflow-y: auto;
}
.nib-todo-planbanner button {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--nib-muted);
  font-size: 15px;
  cursor: default;
  flex: none;
}
.nib-todo-body { flex: 1; display: flex; min-height: 0; }
.nib-todo-views { display: flex; background: var(--nib-chip); border: 1px solid var(--nib-border); border-radius: 8px; padding: 2px; }
.nib-todo-views button {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 12px;
  color: var(--nib-muted);
  padding: 5px 12px;
  border-radius: 6px;
  cursor: default;
}
.nib-todo-views button[data-active='true'] { background: var(--nib-accent); color: #fff; font-weight: 600; }
.nib-todo-plan {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none !important;
  background: var(--nib-accent) !important;
  color: #fff !important;
  font-weight: 600;
  border-radius: 9px;
  padding: 8px 14px !important;
  box-shadow: 0 4px 12px -4px color-mix(in srgb, var(--nib-accent) 60%, transparent);
}
.nib-task-list {
  flex: none;
  overflow-y: auto;
  padding: 8px 14px 30px;
}
.nib-todo-resizer {
  width: 6px;
  flex: none;
  cursor: col-resize;
  background: transparent;
  border-right: 1px solid var(--nib-border);
  transition: background 0.12s;
}
.nib-todo-resizer:hover, .nib-todo-resizer[data-dragging='true'] { background: var(--nib-accent-soft); }
.nib-task-list-section {
  padding: 14px 4px 8px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--nib-section);
}
.nib-task-list-empty { padding: 8px 4px; font-size: 12.5px; color: var(--nib-section); }
.nib-task-card {
  display: flex;
  gap: 11px;
  align-items: flex-start;
  padding: 13px 8px;
  border-bottom: 1px solid var(--nib-border);
}
.nib-task-card[data-dragging='true'] { opacity: 0.6; position: relative; z-index: 30; background: var(--nib-paper); }
.nib-task-check { accent-color: var(--nib-accent); flex: none; width: 18px; height: 18px; margin-top: 2px; }
.nib-task-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
  border: none;
  background: transparent;
  font: inherit;
  text-align: left;
  padding: 0;
  cursor: default;
}
.nib-task-title {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--nib-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nib-task-title[data-done='true'] { text-decoration: line-through; color: var(--nib-section); }
.nib-task-chips { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; }
.nib-task-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--nib-ink-2);
  background: var(--nib-chip);
  border-radius: 6px;
  padding: 2px 8px;
}
.nib-task-chip-streak { color: var(--nib-accent-ink); background: var(--nib-accent-soft); font-weight: 600; }
.nib-task-chip-due { color: var(--nib-danger); background: color-mix(in srgb, var(--nib-danger) 11%, transparent); }
.nib-task-progress { display: flex; align-items: center; gap: 8px; }
.nib-task-progress-bar { flex: 1; height: 5px; border-radius: 3px; background: var(--nib-chip); overflow: hidden; }
.nib-task-progress-bar span { display: block; height: 100%; background: var(--nib-accent); }
.nib-task-progress-count { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10.5px; color: var(--nib-muted); }
.nib-task-week { display: flex; gap: 3px; }
.nib-task-week span { width: 13px; height: 13px; border-radius: 4px; background: var(--nib-chip); }
.nib-task-week span[data-filled='true'] { background: var(--nib-streak); }
.nib-task-grip { color: var(--nib-placeholder); cursor: grab; flex: none; padding: 2px; }
.nib-task-add {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 13px;
  color: var(--nib-muted);
  padding: 14px 4px;
  cursor: default;
}
.nib-timeline { flex: 1; overflow-y: auto; min-width: 0; }
.nib-timeline-inner { position: relative; display: flex; margin: 14px 16px 40px; }
.nib-timeline-gutter { position: relative; width: 46px; flex: none; }
.nib-timeline-gutter span {
  position: absolute;
  transform: translateY(-50%);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: var(--nib-section);
}
.nib-timeline-canvas { position: relative; flex: 1; }
.nib-timeline-slot {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid var(--nib-border);
}
.nib-timeline-slot[data-hour='true'] { border-top-color: var(--nib-border-strong); }
.nib-timeline-slot[data-over='true'] { background: rgba(191, 107, 68, 0.1); }
.nib-timeline-block {
  position: absolute;
  left: 6px;
  right: 10px;
  background: rgba(191, 107, 68, 0.14);
  border: 1px solid rgba(191, 107, 68, 0.4);
  border-left: 3px solid var(--nib-accent);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--nib-ink);
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
.nib-timeline-block-recur { margin-left: auto; color: var(--nib-accent-ink); font-size: 11px; }
.nib-task-detail {
  width: 300px;
  flex: none;
  border-left: 1px solid var(--nib-border);
  background: var(--nib-surface);
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
.nib-task-detail-header button { border: none; background: transparent; font-size: 15px; color: var(--nib-muted); cursor: default; }
.nib-task-detail-title {
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  color: var(--nib-ink);
}
.nib-task-detail-notes {
  border: 1px solid var(--nib-border-strong);
  border-radius: 9px;
  background: var(--nib-paper);
  font: inherit;
  font-size: 12.5px;
  padding: 8px 10px;
  min-height: 64px;
  resize: vertical;
  outline: none;
  color: var(--nib-ink);
}
.nib-task-detail-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--nib-ink-2); }
.nib-task-detail-field > span { font-weight: 600; }
.nib-task-detail-field input, .nib-task-detail-field select {
  font: inherit;
  font-size: 12.5px;
  border: 1px solid var(--nib-border-strong);
  border-radius: 7px;
  background: var(--nib-paper);
  padding: 5px 8px;
  color: var(--nib-ink);
}
.nib-task-detail-habit { flex-direction: row; align-items: center; }
.nib-task-detail-habit input { accent-color: var(--nib-streak); }
.nib-task-detail-streak { margin-left: auto; font-size: 12px; color: var(--nib-streak-ink); font-weight: 700; }
.nib-task-detail-subtasks { display: flex; flex-direction: column; gap: 4px; }
.nib-task-detail-subtask { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--nib-ink); }
.nib-task-detail-subtask input { accent-color: var(--nib-accent); }
.nib-task-detail-subtask span[data-done='true'] { text-decoration: line-through; color: var(--nib-section); }
.nib-task-detail-subtask button { border: none; background: transparent; color: var(--nib-placeholder); margin-left: auto; cursor: default; }
.nib-task-detail-subtask button:hover { color: var(--nib-ink); }
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
  color: var(--nib-danger);
  font: inherit;
  font-size: 12px;
  padding: 7px 0;
  border-radius: 8px;
  cursor: default;
}
.nib-task-detail-delete:hover { background: rgba(191, 68, 68, 0.08); }
.nib-recur { display: flex; flex-direction: column; gap: 6px; }
.nib-recur-row { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--nib-ink-2); }
.nib-recur-row input[type='number'] { width: 54px; }
.nib-recur-day {
  border: 1px solid var(--nib-border-strong);
  background: var(--nib-paper);
  font: inherit;
  font-size: 10.5px;
  padding: 4px 6px;
  border-radius: 6px;
  color: var(--nib-ink-2);
  cursor: default;
}
.nib-recur-day[data-active='true'] { background: rgba(191, 107, 68, 0.16); color: var(--nib-accent-ink); border-color: rgba(191, 107, 68, 0.4); font-weight: 700; }
.nib-recur-text { font-size: 11.5px; color: var(--nib-muted); font-style: italic; }
`;

const CONFETTI_COLORS = ['var(--nib-accent)', 'var(--nib-streak)', '#E4B363', 'var(--nib-diary)', 'var(--nib-paper)'];

const LIST_WIDTH_KEY = 'nib.todo.listWidth';

export function TodoView({ openRequest }: ModuleViewProps) {
  const [tasks, setTasks] = useState<NibRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [detailId, setDetailId] = useState<string>();
  const [toast, setToast] = useState<string>();
  const [view, setView] = useState<'list' | 'day'>('day');
  const [plan, setPlan] = useState<string>();
  const [listWidth, setListWidth] = useState(() => {
    const stored = Number(localStorage.getItem(LIST_WIDTH_KEY));
    return stored >= 240 && stored <= 640 ? stored : 380;
  });
  const [resizing, setResizing] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const startResize = (event: React.PointerEvent) => {
    event.preventDefault();
    setResizing(true);
    const startX = event.clientX;
    const startW = listWidth;
    const onMove = (move: PointerEvent) => {
      const next = Math.min(Math.max(startW + (move.clientX - startX), 240), 640);
      setListWidth(next);
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setListWidth((w) => {
        try {
          localStorage.setItem(LIST_WIDTH_KEY, String(w));
        } catch {
          // ignore
        }
        return w;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

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

  const askNib = async () => {
    if (!window.nib) return;
    const open = model.dayItems.filter((item) => !item.done).map((item) => item.task.title);
    setPlan('Nib is planning your day…');
    try {
      const prompt =
        `Plan my day (${dateLabel}). My open tasks:\n` +
        (open.length ? open.map((t) => `- ${t}`).join('\n') : '(none yet)') +
        `\nSuggest a short, realistic order or time-blocked plan.`;
      const result = (await window.nib.invoke('nib.assistant:chat', [
        { role: 'user', content: prompt },
      ])) as { text: string };
      setPlan(result.text);
    } catch {
      setPlan('Connect a model in Assistant → Settings to have Nib plan your day.');
    }
  };

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
        <div className="nib-todo-views" role="group" aria-label="View">
          <button data-active={view === 'list'} onClick={() => setView('list')}>
            List
          </button>
          <button data-active={view === 'day'} onClick={() => setView('day')}>
            Day
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <button className="nib-todo-plan" onClick={() => void askNib()}>
          <Icon name="sparkles" size={15} />
          Ask Nib to plan my day
        </button>
        {toast && <span className="nib-todo-toast">{toast}</span>}
      </div>

      {plan && (
        <div className="nib-todo-planbanner">
          <Icon name="sparkles" size={14} style={{ color: 'var(--nib-accent)', flex: 'none' }} />
          <span>{plan}</span>
          <button onClick={() => setPlan(undefined)}>×</button>
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="nib-todo-body">
          <TaskList
            dayItems={model.dayItems}
            inbox={model.inbox}
            width={view === 'day' ? listWidth : '100%'}
            onToggle={toggle}
            onOpen={(task) => setDetailId(task.id)}
            onNewTask={() => void newTask()}
          />
          {view === 'day' && (
            <>
              <div
                className="nib-todo-resizer"
                data-dragging={resizing}
                onPointerDown={startResize}
              />
              <Timeline blocks={model.blocks} onOpen={(task) => setDetailId(task.id)} />
            </>
          )}
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
