import { describe, expect, it } from 'vitest';
import type { TaskProps } from './shared';
import {
  addDaysStr,
  applyOccurrenceCompletion,
  applyOccurrenceUncompletion,
  buildRecurrence,
  computeStreak,
  describeRecurrence,
  isValidRecurrence,
  occursOn,
  previousOccurrence,
  toggleSimpleTask,
} from './tasklogic';

// July 2026 reference: Jul 1 = Wednesday, Jul 4 = Saturday, Jul 6 = Monday.

describe('occursOn', () => {
  it('daily occurs every day from the anchor', () => {
    expect(occursOn('FREQ=DAILY', '2026-07-01', '2026-07-01')).toBe(true);
    expect(occursOn('FREQ=DAILY', '2026-07-01', '2026-07-19')).toBe(true);
    expect(occursOn('FREQ=DAILY', '2026-07-01', '2026-06-30')).toBe(false);
  });

  it('every 3 days lands on anchor + multiples of 3', () => {
    const rule = buildRecurrence({ kind: 'everyN', n: 3 });
    expect(occursOn(rule, '2026-07-01', '2026-07-01')).toBe(true);
    expect(occursOn(rule, '2026-07-01', '2026-07-04')).toBe(true);
    expect(occursOn(rule, '2026-07-01', '2026-07-07')).toBe(true);
    expect(occursOn(rule, '2026-07-01', '2026-07-02')).toBe(false);
    expect(occursOn(rule, '2026-07-01', '2026-07-06')).toBe(false);
  });

  it('weekly on specific weekdays (Mon, Wed)', () => {
    const rule = buildRecurrence({ kind: 'weekly', weekdays: [0, 2] });
    expect(rule).toBe('FREQ=WEEKLY;BYDAY=MO,WE');
    expect(occursOn(rule, '2026-07-01', '2026-07-01')).toBe(true);
    expect(occursOn(rule, '2026-07-01', '2026-07-06')).toBe(true);
    expect(occursOn(rule, '2026-07-01', '2026-07-08')).toBe(true);
    expect(occursOn(rule, '2026-07-01', '2026-07-07')).toBe(false);
    expect(occursOn(rule, '2026-07-01', '2026-07-04')).toBe(false);
  });

  it('monthly on the 2nd Tuesday', () => {
    const rule = buildRecurrence({ kind: 'monthlyNthWeekday', nth: 2, weekday: 1 });
    expect(rule).toBe('FREQ=MONTHLY;BYDAY=2TU');
    expect(occursOn(rule, '2026-07-01', '2026-07-14')).toBe(true);
    expect(occursOn(rule, '2026-07-01', '2026-07-07')).toBe(false);
    expect(occursOn(rule, '2026-07-01', '2026-08-11')).toBe(true);
  });

  it('monthly on the last Friday', () => {
    const rule = buildRecurrence({ kind: 'monthlyNthWeekday', nth: -1, weekday: 4 });
    expect(occursOn(rule, '2026-07-01', '2026-07-31')).toBe(true);
    expect(occursOn(rule, '2026-07-01', '2026-07-24')).toBe(false);
  });

  it('is false for garbage rules instead of throwing', () => {
    expect(occursOn('FREQ=NONSENSE', '2026-07-01', '2026-07-01')).toBe(false);
    expect(isValidRecurrence('FREQ=DAILY', '2026-07-01')).toBe(true);
  });
});

describe('previousOccurrence', () => {
  it('walks back within the rule', () => {
    const rule = 'FREQ=WEEKLY;BYDAY=MO';
    expect(previousOccurrence(rule, '2026-07-06', '2026-07-20')).toBe('2026-07-13');
    expect(previousOccurrence(rule, '2026-07-06', '2026-07-13')).toBe('2026-07-06');
    expect(previousOccurrence(rule, '2026-07-06', '2026-07-06')).toBe(null);
  });
});

describe('computeStreak', () => {
  const daily = (completions: string[]) => ({
    recurrence: 'FREQ=DAILY',
    recurrenceAnchor: '2026-07-01',
    completions,
  });

  it('counts consecutive days up to yesterday with today pending', () => {
    const streak = computeStreak(daily(['2026-07-01', '2026-07-02', '2026-07-03']), '2026-07-04');
    expect(streak.current).toBe(3);
  });

  it('includes today once completed', () => {
    const streak = computeStreak(
      daily(['2026-07-02', '2026-07-03', '2026-07-04']),
      '2026-07-04',
    );
    expect(streak.current).toBe(3);
  });

  it('a missed day resets current but best remembers the old chain', () => {
    const streak = computeStreak(
      daily(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-05']),
      '2026-07-05',
    );
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(3);
  });

  it('weekly habits count consecutive scheduled weekdays, ignoring gaps between', () => {
    const weekly = {
      recurrence: 'FREQ=WEEKLY;BYDAY=MO',
      recurrenceAnchor: '2026-07-06',
      completions: ['2026-07-06', '2026-07-13'],
    };
    expect(computeStreak(weekly, '2026-07-15').current).toBe(2);
    expect(computeStreak(weekly, '2026-07-21').current).toBe(0);
  });
});

describe('applyOccurrenceCompletion', () => {
  const habit: TaskProps = {
    status: 'open',
    recurrence: 'FREQ=DAILY',
    recurrenceAnchor: '2026-07-01',
    completions: ['2026-07-02', '2026-07-03'],
    habit: true,
    streak: { current: 2, best: 2 },
  };

  it('detects a milestone crossing', () => {
    const result = applyOccurrenceCompletion(habit, '2026-07-04');
    expect(result.props.completions).toContain('2026-07-04');
    expect(result.props.streak).toEqual({ current: 3, best: 3 });
    expect(result.milestone).toBe(3);
  });

  it('does not re-fire a milestone for an idempotent completion', () => {
    const once = applyOccurrenceCompletion(habit, '2026-07-04');
    const twice = applyOccurrenceCompletion(once.props, '2026-07-04');
    expect(twice.milestone).toBeUndefined();
    expect(twice.props.completions).toEqual(once.props.completions);
  });

  it('uncompletion recomputes the streak down', () => {
    const done = applyOccurrenceCompletion(habit, '2026-07-04').props;
    const undone = applyOccurrenceUncompletion(done, '2026-07-04', '2026-07-04');
    expect(undone.streak?.current).toBe(2);
    expect(undone.completions).not.toContain('2026-07-04');
  });

  it('non-habit recurring tasks record completions without streaks', () => {
    const chore: TaskProps = {
      status: 'open',
      recurrence: 'FREQ=DAILY',
      recurrenceAnchor: '2026-07-01',
      completions: [],
    };
    const result = applyOccurrenceCompletion(chore, '2026-07-04');
    expect(result.props.streak).toBeUndefined();
    expect(result.milestone).toBeUndefined();
  });
});

describe('simple tasks and dates', () => {
  it('toggleSimpleTask flips status and stamps completedAt', () => {
    const open: TaskProps = { status: 'open' };
    const done = toggleSimpleTask(open, true, 123);
    expect(done).toMatchObject({ status: 'done', completedAt: 123 });
    expect(toggleSimpleTask(done, false, 456).completedAt).toBeUndefined();
  });

  it('addDaysStr crosses month boundaries', () => {
    expect(addDaysStr('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDaysStr('2026-07-01', -1)).toBe('2026-06-30');
  });

  it('describeRecurrence renders human text', () => {
    expect(describeRecurrence('FREQ=WEEKLY;BYDAY=MO,WE', '2026-07-01')).toMatch(/monday/i);
  });
});
