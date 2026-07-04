import { describe, expect, it } from 'vitest';
import type { NibRecord } from '@nib/plugin-api';
import { parseFacts } from './memory';
import { inQuietHours, shouldDeliver, staleTasks, templateNudge } from './nudges';

describe('parseFacts', () => {
  it('parses a clean JSON array', () => {
    expect(parseFacts('["Likes tea", "Works on Nib"]')).toEqual(['Likes tea', 'Works on Nib']);
  });

  it('extracts the array out of fenced or chatty responses', () => {
    expect(parseFacts('Sure! Here you go:\n```json\n["Owns a cat"]\n```\nHope that helps.')).toEqual([
      'Owns a cat',
    ]);
  });

  it('caps at three facts and drops junk items', () => {
    expect(parseFacts('["a", "Real fact one", 5, "Real fact two", "Real three", "Real four"]')).toEqual([
      'Real fact one',
      'Real fact two',
      'Real three',
    ]);
  });

  it('returns empty for garbage', () => {
    expect(parseFacts('no json here')).toEqual([]);
    expect(parseFacts('{"not": "an array"}')).toEqual([]);
  });
});

describe('quiet hours and throttling', () => {
  it('handles ranges that wrap midnight', () => {
    const quiet = { start: 22, end: 8 };
    expect(inQuietHours(23, quiet)).toBe(true);
    expect(inQuietHours(3, quiet)).toBe(true);
    expect(inQuietHours(8, quiet)).toBe(false);
    expect(inQuietHours(12, quiet)).toBe(false);
  });

  it('handles same-day ranges', () => {
    const quiet = { start: 13, end: 15 };
    expect(inQuietHours(14, quiet)).toBe(true);
    expect(inQuietHours(16, quiet)).toBe(false);
  });

  it('shouldDeliver enforces the hourly throttle outside quiet hours', () => {
    const quiet = { start: 22, end: 8 };
    const noon = new Date('2026-07-04T12:00:00');
    expect(shouldDeliver(noon, noon.getTime() - 61 * 60_000, quiet)).toBe(true);
    expect(shouldDeliver(noon, noon.getTime() - 10 * 60_000, quiet)).toBe(false);
    const night = new Date('2026-07-04T23:30:00');
    expect(shouldDeliver(night, 0, quiet)).toBe(false);
  });
});

describe('staleTasks', () => {
  const task = (props: Record<string, unknown>): NibRecord => ({
    id: Math.random().toString(36),
    type: 'task',
    moduleId: 'nib.todo',
    title: 't',
    bodyMd: '',
    props,
    tags: [],
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  });

  it('keeps only open, non-recurring, overdue tasks', () => {
    const records = [
      task({ status: 'open', dueDate: '2026-07-01' }),
      task({ status: 'done', dueDate: '2026-07-01' }),
      task({ status: 'open', dueDate: '2026-07-04' }),
      task({ status: 'open', recurrence: 'FREQ=DAILY', dueDate: '2026-07-01' }),
      task({ status: 'open' }),
    ];
    const stale = staleTasks(records, '2026-07-02');
    expect(stale).toHaveLength(1);
    expect(stale[0]!.props).toMatchObject({ dueDate: '2026-07-01' });
  });
});

describe('templateNudge', () => {
  it('renders each kind', () => {
    expect(templateNudge('milestone', { title: 'Stretch', streak: 7 })).toContain('7-day streak');
    expect(templateNudge('on-this-day', { count: 2 })).toContain('2 diary entries');
    expect(templateNudge('stale-task', { title: 'Taxes', dueDate: '2026-07-01' })).toContain(
      'Taxes',
    );
  });
});
