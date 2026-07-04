import type { NibRecord } from '@nib/plugin-api';
import { isRecurring, taskProps, type TaskProps } from '../shared';
import { occursOn } from '../tasklogic';

export interface DayItem {
  /** Stable list key: task id, or `id@date` for recurring occurrences. */
  key: string;
  task: NibRecord;
  props: TaskProps;
  /** True when this row is one occurrence of a recurring template. */
  occurrence: boolean;
  done: boolean;
}

export interface DayModel {
  dayItems: DayItem[];
  inbox: DayItem[];
  blocks: DayItem[];
}

export function buildDayModel(tasks: NibRecord[], date: string): DayModel {
  const dayItems: DayItem[] = [];
  const inbox: DayItem[] = [];

  for (const task of tasks) {
    const props = taskProps(task);
    if (isRecurring(props)) {
      if (occursOn(props.recurrence!, props.recurrenceAnchor!, date)) {
        dayItems.push({
          key: `${task.id}@${date}`,
          task,
          props,
          occurrence: true,
          done: (props.completions ?? []).includes(date),
        });
      }
      continue;
    }
    const onThisDay = props.dueDate === date || props.scheduled?.date === date;
    const item: DayItem = {
      key: task.id,
      task,
      props,
      occurrence: false,
      done: props.status === 'done',
    };
    if (onThisDay) dayItems.push(item);
    else if (props.status === 'open' && !props.dueDate && !props.scheduled) inbox.push(item);
  }

  const blocks = dayItems.filter(
    (item) =>
      item.props.scheduled &&
      (item.occurrence || item.props.scheduled.date === date) &&
      item.props.scheduled.startMinutes !== undefined,
  );

  return { dayItems, inbox, blocks };
}
