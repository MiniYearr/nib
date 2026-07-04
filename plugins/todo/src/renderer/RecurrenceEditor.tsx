import { useMemo } from 'react';
import {
  buildRecurrence,
  describeRecurrence,
  todayStr,
  type RecurrencePreset,
} from '../tasklogic';

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export interface RecurrenceValue {
  recurrence?: string;
  recurrenceAnchor?: string;
}

export interface RecurrenceEditorProps {
  value: RecurrenceValue;
  onChange(value: RecurrenceValue): void;
}

type Kind = 'none' | RecurrencePreset['kind'];

/** Reads the coarse preset back out of a stored RRULE so the controls stay in sync. */
function presetOf(recurrence: string | undefined): {
  kind: Kind;
  n: number;
  weekdays: number[];
  nth: 1 | 2 | 3 | 4 | -1;
  weekday: number;
} {
  const preset = { kind: 'none' as Kind, n: 2, weekdays: [] as number[], nth: 1 as const, weekday: 0 };
  if (!recurrence) return preset;
  const parts = Object.fromEntries(
    recurrence.split(';').map((part) => part.split('=') as [string, string]),
  );
  const byday = parts.BYDAY?.split(',') ?? [];
  const codes = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  if (parts.FREQ === 'DAILY') {
    const interval = Number(parts.INTERVAL ?? 1);
    return interval > 1 ? { ...preset, kind: 'everyN', n: interval } : { ...preset, kind: 'daily' };
  }
  if (parts.FREQ === 'WEEKLY') {
    return { ...preset, kind: 'weekly', weekdays: byday.map((d) => codes.indexOf(d)).filter((i) => i >= 0) };
  }
  if (parts.FREQ === 'MONTHLY' && byday[0]) {
    const match = /^(-?\d)([A-Z]{2})$/.exec(byday[0]);
    if (match) {
      return {
        ...preset,
        kind: 'monthlyNthWeekday',
        nth: Number(match[1]) as 1 | 2 | 3 | 4 | -1,
        weekday: codes.indexOf(match[2]!),
      };
    }
  }
  return preset;
}

export function RecurrenceEditor({ value, onChange }: RecurrenceEditorProps) {
  const state = useMemo(() => presetOf(value.recurrence), [value.recurrence]);
  const anchor = value.recurrenceAnchor ?? todayStr();

  const apply = (preset: RecurrencePreset | null) => {
    if (!preset) {
      onChange({ recurrence: undefined, recurrenceAnchor: undefined });
      return;
    }
    onChange({ recurrence: buildRecurrence(preset), recurrenceAnchor: anchor });
  };

  const changeKind = (kind: Kind) => {
    if (kind === 'none') apply(null);
    else if (kind === 'daily') apply({ kind: 'daily' });
    else if (kind === 'everyN') apply({ kind: 'everyN', n: state.n });
    else if (kind === 'weekly') apply({ kind: 'weekly', weekdays: state.weekdays.length ? state.weekdays : [0] });
    else apply({ kind: 'monthlyNthWeekday', nth: state.nth, weekday: state.weekday });
  };

  return (
    <div className="nib-recur">
      <select value={state.kind} onChange={(event) => changeKind(event.target.value as Kind)}>
        <option value="none">Does not repeat</option>
        <option value="daily">Daily</option>
        <option value="everyN">Every N days</option>
        <option value="weekly">Weekly on…</option>
        <option value="monthlyNthWeekday">Monthly on the…</option>
      </select>

      {state.kind === 'everyN' && (
        <label className="nib-recur-row">
          every
          <input
            type="number"
            min={2}
            max={365}
            value={state.n}
            onChange={(event) => apply({ kind: 'everyN', n: Number(event.target.value) || 2 })}
          />
          days
        </label>
      )}

      {state.kind === 'weekly' && (
        <div className="nib-recur-row">
          {WEEKDAY_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              className="nib-recur-day"
              data-active={state.weekdays.includes(index)}
              onClick={() => {
                const weekdays = state.weekdays.includes(index)
                  ? state.weekdays.filter((day) => day !== index)
                  : [...state.weekdays, index].sort();
                if (weekdays.length > 0) apply({ kind: 'weekly', weekdays });
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {state.kind === 'monthlyNthWeekday' && (
        <div className="nib-recur-row">
          <select
            value={state.nth}
            onChange={(event) =>
              apply({
                kind: 'monthlyNthWeekday',
                nth: Number(event.target.value) as 1 | 2 | 3 | 4 | -1,
                weekday: state.weekday,
              })
            }
          >
            <option value={1}>1st</option>
            <option value={2}>2nd</option>
            <option value={3}>3rd</option>
            <option value={4}>4th</option>
            <option value={-1}>last</option>
          </select>
          <select
            value={state.weekday}
            onChange={(event) =>
              apply({
                kind: 'monthlyNthWeekday',
                nth: state.nth,
                weekday: Number(event.target.value),
              })
            }
          >
            {WEEKDAY_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {value.recurrence && (
        <div className="nib-recur-text">{describeRecurrence(value.recurrence, anchor)}</div>
      )}
    </div>
  );
}
