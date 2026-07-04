import type { NibPluginContext, NibPluginModule } from '@nib/plugin-api';
import { MODULE_ID, TASK_TYPE, isRecurring, taskProps } from './shared';
import { computeStreak, todayStr } from './tasklogic';

export { MODULE_ID, TASK_TYPE };

function nextMidnight(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 5, 0);
  return next.getTime();
}

/**
 * The midnight rollover re-derives every habit's streak so a missed day
 * zeroes `current` even if the user never opens the day view.
 */
function rolloverStreaks(ctx: NibPluginContext, today: string): number {
  let updated = 0;
  for (const record of ctx.records.list({ type: TASK_TYPE, limit: 10_000 })) {
    const props = taskProps(record);
    if (!props.habit || !isRecurring(props)) continue;
    const streak = computeStreak(
      {
        recurrence: props.recurrence!,
        recurrenceAnchor: props.recurrenceAnchor!,
        completions: props.completions ?? [],
      },
      today,
    );
    if (props.streak?.current !== streak.current || props.streak?.best !== streak.best) {
      ctx.records.update(record.id, { props: { ...record.props, streak } });
      updated += 1;
    }
  }
  return updated;
}

const todoPlugin: NibPluginModule = {
  manifest: {
    id: MODULE_ID,
    name: 'To-do',
    version: '0.1.0',
    minAppVersion: '0.1.0',
    description: 'Tasks with recurrence, subtasks, time blocking, and habit streaks.',
    permissions: [
      `records:read:${TASK_TYPE}`,
      `records:write:${TASK_TYPE}`,
      'scheduler',
      'events:subscribe:record.*',
    ],
    contributes: {
      recordTypes: [{ type: TASK_TYPE, title: 'Task' }],
      commands: [{ id: 'new-task', title: 'New task' }],
    },
  },

  activate(ctx) {
    ctx.commands.register({
      id: 'new-task',
      title: 'New task',
      category: 'To-do',
      run() {
        const task = ctx.records.create({
          type: TASK_TYPE,
          title: 'New task',
          props: { status: 'open', dueDate: todayStr() },
        });
        ctx.log.info(`created task ${task.id}`);
      },
    });

    ctx.scheduler.onJob('rollover', () => {
      const today = todayStr();
      const updated = rolloverStreaks(ctx, today);
      ctx.log.info(`rollover for ${today}: ${updated} streaks updated`);
      ctx.events.emit(`${MODULE_ID}.day-rolled`, { date: today });
      ctx.scheduler.schedule({ kind: 'rollover', runAt: nextMidnight(), unique: true });
    });
    ctx.scheduler.schedule({ kind: 'rollover', runAt: nextMidnight(), unique: true });
  },
};

export default todoPlugin;
