import type { DatabaseSync } from 'node:sqlite';
import type { EventBus } from './events';
import { newJobId } from './ids';

/** Timer chunk cap: re-arm at least once a minute so far-future jobs never overflow setTimeout. */
const MAX_TIMER_DELAY_MS = 60_000;

export interface JobRow {
  id: string;
  kind: string;
  module_id: string;
  run_at: number;
  interval_ms: number | null;
  payload: string;
}

export interface ScheduleJobInput {
  /** Fully namespaced kind, e.g. "nib.todo.materialize-recurrence". */
  kind: string;
  moduleId: string;
  runAt: number;
  intervalMs?: number;
  payload?: Record<string, unknown>;
}

export type JobHandler = (payload: Record<string, unknown>) => void;

export interface Scheduler {
  schedule(input: ScheduleJobInput): string;
  cancel(moduleId: string, jobId: string): void;
  /** Returns an unregister function. */
  onJob(kind: string, handler: JobHandler): () => void;
  start(): void;
  stop(): void;
}

export function createScheduler(deps: {
  db: DatabaseSync;
  bus: EventBus;
  now?: () => number;
}): Scheduler {
  const { db, bus } = deps;
  const now = deps.now ?? Date.now;
  const handlers = new Map<string, Set<JobHandler>>();
  let timer: NodeJS.Timeout | undefined;
  let started = false;

  function arm(): void {
    if (!started) return;
    if (timer) clearTimeout(timer);
    timer = undefined;
    const next = db.prepare('SELECT run_at FROM jobs ORDER BY run_at LIMIT 1').get() as
      | { run_at: number }
      | undefined;
    if (!next) return;
    const delay = Math.min(Math.max(next.run_at - now(), 0), MAX_TIMER_DELAY_MS);
    timer = setTimeout(tick, delay);
  }

  function fire(job: JobRow): void {
    const payload = JSON.parse(job.payload) as Record<string, unknown>;
    bus.emit(
      'scheduler.fired',
      { jobId: job.id, kind: job.kind, moduleId: job.module_id, payload },
      'core',
    );
    for (const handler of handlers.get(job.kind) ?? []) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[nib:scheduler] handler for "${job.kind}" threw`, error);
      }
    }
  }

  function tick(): void {
    const due = db
      .prepare('SELECT * FROM jobs WHERE run_at <= ? ORDER BY run_at')
      .all(now()) as unknown as JobRow[];
    for (const job of due) {
      fire(job);
      if (job.interval_ms && job.interval_ms > 0) {
        let nextRun = job.run_at + job.interval_ms;
        // A long sleep (laptop lid closed) fires once, then skips to the future.
        while (nextRun <= now()) nextRun += job.interval_ms;
        db.prepare('UPDATE jobs SET run_at = ? WHERE id = ?').run(nextRun, job.id);
      } else {
        db.prepare('DELETE FROM jobs WHERE id = ?').run(job.id);
      }
    }
    arm();
  }

  return {
    schedule(input) {
      const id = newJobId();
      db.prepare(
        'INSERT INTO jobs (id, kind, module_id, run_at, interval_ms, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(
        id,
        input.kind,
        input.moduleId,
        input.runAt,
        input.intervalMs ?? null,
        JSON.stringify(input.payload ?? {}),
        now(),
      );
      arm();
      return id;
    },

    cancel(moduleId, jobId) {
      db.prepare('DELETE FROM jobs WHERE id = ? AND module_id = ?').run(jobId, moduleId);
      arm();
    },

    onJob(kind, handler) {
      const set = handlers.get(kind) ?? new Set();
      set.add(handler);
      handlers.set(kind, set);
      return () => {
        set.delete(handler);
      };
    },

    start() {
      started = true;
      tick();
    },

    stop() {
      started = false;
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}
