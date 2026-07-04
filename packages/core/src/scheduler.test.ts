import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from './db';
import { createEventBus } from './events';
import { createScheduler, type Scheduler } from './scheduler';

describe('scheduler', () => {
  let db: DatabaseSync;
  let scheduler: Scheduler;
  let bus: ReturnType<typeof createEventBus>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(1_000_000);
    db = openDatabase(':memory:');
    bus = createEventBus();
    scheduler = createScheduler({ db, bus });
  });

  afterEach(() => {
    scheduler.stop();
    db.close();
    vi.useRealTimers();
  });

  it('fires a one-shot job at its time and deletes it', () => {
    const handler = vi.fn();
    scheduler.onJob('m.ping', handler);
    scheduler.start();
    scheduler.schedule({ kind: 'm.ping', moduleId: 'm', runAt: Date.now() + 5000, payload: { n: 1 } });

    vi.advanceTimersByTime(4999);
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(handler).toHaveBeenCalledExactlyOnceWith({ n: 1 });
    expect(db.prepare('SELECT count(*) AS c FROM jobs').get()).toEqual({ c: 0 });
  });

  it('emits scheduler.fired on the bus', () => {
    const seen = vi.fn();
    bus.on('scheduler.fired', seen);
    scheduler.start();
    scheduler.schedule({ kind: 'm.tick', moduleId: 'm', runAt: Date.now() + 100 });
    vi.advanceTimersByTime(100);
    expect(seen).toHaveBeenCalledOnce();
    expect(seen.mock.calls[0]![0].payload).toMatchObject({ kind: 'm.tick', moduleId: 'm' });
  });

  it('reschedules interval jobs', () => {
    const handler = vi.fn();
    scheduler.onJob('m.every10', handler);
    scheduler.start();
    scheduler.schedule({
      kind: 'm.every10',
      moduleId: 'm',
      runAt: Date.now() + 10_000,
      intervalMs: 10_000,
    });

    vi.advanceTimersByTime(30_000);
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('fires a missed job once on start and skips the backlog', () => {
    const handler = vi.fn();
    scheduler.onJob('m.daily', handler);
    scheduler.schedule({
      kind: 'm.daily',
      moduleId: 'm',
      runAt: Date.now() - 25_000,
      intervalMs: 10_000,
    });

    scheduler.start();
    expect(handler).toHaveBeenCalledTimes(1);
    const row = db.prepare('SELECT run_at FROM jobs').get() as { run_at: number };
    expect(row.run_at).toBeGreaterThan(Date.now());
  });

  it('cancel removes a job scoped to its module', () => {
    const handler = vi.fn();
    scheduler.onJob('m.once', handler);
    scheduler.start();
    const id = scheduler.schedule({ kind: 'm.once', moduleId: 'm', runAt: Date.now() + 1000 });

    scheduler.cancel('other-module', id);
    expect(db.prepare('SELECT count(*) AS c FROM jobs').get()).toEqual({ c: 1 });

    scheduler.cancel('m', id);
    vi.advanceTimersByTime(2000);
    expect(handler).not.toHaveBeenCalled();
  });

  it('unique jobs replace earlier ones of the same kind and module', () => {
    scheduler.start();
    scheduler.schedule({ kind: 'm.rollover', moduleId: 'm', runAt: Date.now() + 1000, unique: true });
    scheduler.schedule({ kind: 'm.rollover', moduleId: 'm', runAt: Date.now() + 2000, unique: true });
    scheduler.schedule({ kind: 'other.rollover', moduleId: 'other', runAt: Date.now() + 2000, unique: true });
    expect(db.prepare('SELECT count(*) AS c FROM jobs').get()).toEqual({ c: 2 });
  });

  it('reaches far-future jobs by re-arming in capped chunks', () => {
    const handler = vi.fn();
    scheduler.onJob('m.far', handler);
    scheduler.start();
    scheduler.schedule({ kind: 'm.far', moduleId: 'm', runAt: Date.now() + 10 * 60_000 });

    vi.advanceTimersByTime(9 * 60_000);
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(handler).toHaveBeenCalledOnce();
  });
});
