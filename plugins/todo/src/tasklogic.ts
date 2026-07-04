import { RRule } from 'rrule';
import { MILESTONES, type TaskProps } from './shared';

/**
 * All recurrence math treats dates as UTC-floating calendar dates ('YYYY-MM-DD'
 * anchored to UTC midnight), never local instants — so DST shifts and
 * timezones cannot move an occurrence to a neighboring day.
 */

export function toUtcDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

export function fromUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The user's local calendar date. */
export function todayStr(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysStr(date: string, days: number): string {
  const utc = toUtcDate(date);
  utc.setUTCDate(utc.getUTCDate() + days);
  return fromUtcDate(utc);
}

function ruleFor(recurrence: string, anchor: string): RRule {
  return new RRule({ ...RRule.parseString(recurrence), dtstart: toUtcDate(anchor) });
}

export function isValidRecurrence(recurrence: string, anchor: string): boolean {
  try {
    ruleFor(recurrence, anchor);
    return true;
  } catch {
    return false;
  }
}

export function occursOn(recurrence: string, anchor: string, date: string): boolean {
  try {
    const start = toUtcDate(date);
    const end = new Date(start.getTime() + 86_399_999);
    return ruleFor(recurrence, anchor).between(start, end, true).length > 0;
  } catch {
    return false;
  }
}

export function previousOccurrence(
  recurrence: string,
  anchor: string,
  before: string,
): string | null {
  try {
    const found = ruleFor(recurrence, anchor).before(toUtcDate(before), false);
    return found ? fromUtcDate(found) : null;
  } catch {
    return null;
  }
}

function lastOccurrenceOnOrBefore(
  recurrence: string,
  anchor: string,
  date: string,
): string | null {
  return occursOn(recurrence, anchor, date)
    ? date
    : previousOccurrence(recurrence, anchor, date);
}

export interface StreakInput {
  recurrence: string;
  recurrenceAnchor: string;
  completions: string[];
}

/**
 * `current` counts consecutive completed occurrences ending at the most recent
 * scheduled occurrence — except that today's still-pending occurrence does not
 * break the chain. `best` is the longest chain anywhere in history.
 */
export function computeStreak(
  input: StreakInput,
  today: string,
): { current: number; best: number } {
  const done = new Set(input.completions);
  const prev = (date: string) =>
    previousOccurrence(input.recurrence, input.recurrenceAnchor, date);

  let cursor = lastOccurrenceOnOrBefore(input.recurrence, input.recurrenceAnchor, today);
  if (cursor === today && !done.has(today)) cursor = prev(today);

  let current = 0;
  while (cursor && done.has(cursor)) {
    current += 1;
    cursor = prev(cursor);
  }

  let best = current;
  let chain = 0;
  for (const date of [...done].sort()) {
    const previous = prev(date);
    chain = previous && done.has(previous) ? chain + 1 : 1;
    if (chain > best) best = chain;
  }

  return { current, best };
}

export interface CompletionResult {
  props: TaskProps;
  /** Set when this completion pushed the streak onto a celebration milestone. */
  milestone?: number;
}

export function applyOccurrenceCompletion(
  props: TaskProps,
  date: string,
  today: string = date,
): CompletionResult {
  const completions = [...new Set([...(props.completions ?? []), date])].sort();
  const next: TaskProps = { ...props, completions };

  if (props.habit && props.recurrence && props.recurrenceAnchor) {
    const previousCurrent = props.streak?.current ?? 0;
    const streak = computeStreak(
      { recurrence: props.recurrence, recurrenceAnchor: props.recurrenceAnchor, completions },
      today,
    );
    next.streak = streak;
    if (MILESTONES.includes(streak.current) && streak.current > previousCurrent) {
      return { props: next, milestone: streak.current };
    }
  }
  return { props: next };
}

export function applyOccurrenceUncompletion(
  props: TaskProps,
  date: string,
  today: string = date,
): TaskProps {
  const completions = (props.completions ?? []).filter((day) => day !== date);
  const next: TaskProps = { ...props, completions };
  if (props.habit && props.recurrence && props.recurrenceAnchor) {
    next.streak = computeStreak(
      { recurrence: props.recurrence, recurrenceAnchor: props.recurrenceAnchor, completions },
      today,
    );
  }
  return next;
}

export function toggleSimpleTask(props: TaskProps, done: boolean, now: number): TaskProps {
  return {
    ...props,
    status: done ? 'done' : 'open',
    completedAt: done ? now : undefined,
  };
}

const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

export type RecurrencePreset =
  | { kind: 'daily' }
  | { kind: 'everyN'; n: number }
  | { kind: 'weekly'; weekdays: number[] }
  | { kind: 'monthlyNthWeekday'; nth: 1 | 2 | 3 | 4 | -1; weekday: number };

export function buildRecurrence(preset: RecurrencePreset): string {
  switch (preset.kind) {
    case 'daily':
      return 'FREQ=DAILY';
    case 'everyN':
      return `FREQ=DAILY;INTERVAL=${Math.max(1, Math.round(preset.n))}`;
    case 'weekly': {
      const days = preset.weekdays.map((day) => WEEKDAY_CODES[day]).filter(Boolean);
      return days.length > 0 ? `FREQ=WEEKLY;BYDAY=${days.join(',')}` : 'FREQ=WEEKLY';
    }
    case 'monthlyNthWeekday':
      return `FREQ=MONTHLY;BYDAY=${preset.nth}${WEEKDAY_CODES[preset.weekday]}`;
  }
}

export function describeRecurrence(recurrence: string, anchor: string): string {
  try {
    return ruleFor(recurrence, anchor).toText();
  } catch {
    return recurrence;
  }
}
