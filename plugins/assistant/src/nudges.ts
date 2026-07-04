import type { NibRecord } from '@nib/plugin-api';

export const NUDGE_THROTTLE_MS = 60 * 60 * 1000;

export interface QuietHours {
  start: number;
  end: number;
}

/** Handles ranges that wrap midnight, e.g. {start: 22, end: 8}. */
export function inQuietHours(hour: number, quiet: QuietHours): boolean {
  if (quiet.start === quiet.end) return false;
  return quiet.start > quiet.end
    ? hour >= quiet.start || hour < quiet.end
    : hour >= quiet.start && hour < quiet.end;
}

export function shouldDeliver(now: Date, lastDeliveredAt: number, quiet: QuietHours): boolean {
  if (inQuietHours(now.getHours(), quiet)) return false;
  return now.getTime() - lastDeliveredAt >= NUDGE_THROTTLE_MS;
}

/** Open, non-recurring tasks whose due date is on or before `cutoffDate`. */
export function staleTasks(records: NibRecord[], cutoffDate: string): NibRecord[] {
  return records.filter((record) => {
    const props = record.props as {
      status?: string;
      recurrence?: string;
      dueDate?: string;
    };
    return (
      props.status === 'open' &&
      !props.recurrence &&
      typeof props.dueDate === 'string' &&
      props.dueDate <= cutoffDate
    );
  });
}

export function templateNudge(
  kind: 'milestone' | 'on-this-day' | 'stale-task',
  data: { title?: string; streak?: number; count?: number; dueDate?: string },
): string {
  switch (kind) {
    case 'milestone':
      return `🔥 ${data.streak}-day streak on “${data.title}”! Keep it rolling.`;
    case 'on-this-day':
      return data.count === 1
        ? 'You wrote a diary entry on this day in a past year. Take a peek?'
        : `You wrote ${data.count} diary entries on this day in past years. Take a peek?`;
    case 'stale-task':
      return `“${data.title}” has been waiting since ${data.dueDate}. One tiny step today?`;
  }
}
