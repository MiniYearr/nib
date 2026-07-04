import type { NibRecord } from '@nib/plugin-api';

export const MODULE_ID = 'nib.todo';
export const TASK_TYPE = 'task';

/** Streak lengths that earn a celebration. */
export const MILESTONES = [3, 7, 14, 30, 60, 100, 365];

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface ScheduledBlock {
  /** Calendar date for one-time tasks; recurring tasks block the same time on every occurrence day. */
  date?: string;
  startMinutes: number;
  durationMinutes: number;
}

export interface TaskProps {
  status: 'open' | 'done';
  completedAt?: number;
  /** 'YYYY-MM-DD' calendar date. */
  dueDate?: string;
  scheduled?: ScheduledBlock;
  /** RFC 5545 RRULE body, e.g. "FREQ=WEEKLY;BYDAY=MO,WE". Presence makes this a recurring template. */
  recurrence?: string;
  /** DTSTART calendar date the rule is anchored to. */
  recurrenceAnchor?: string;
  /** Completed occurrence dates for recurring templates. */
  completions?: string[];
  habit?: boolean;
  streak?: { current: number; best: number };
  subtasks?: Subtask[];
}

export function taskProps(record: NibRecord): TaskProps {
  const props = record.props as Partial<TaskProps>;
  return {
    status: props.status === 'done' ? 'done' : 'open',
    completedAt: props.completedAt,
    dueDate: props.dueDate,
    scheduled: props.scheduled,
    recurrence: props.recurrence,
    recurrenceAnchor: props.recurrenceAnchor,
    completions: props.completions ?? [],
    habit: props.habit ?? false,
    streak: props.streak,
    subtasks: props.subtasks ?? [],
  };
}

export function isRecurring(props: TaskProps): boolean {
  return Boolean(props.recurrence && props.recurrenceAnchor);
}
