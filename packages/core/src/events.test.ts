import { describe, expect, it, vi } from 'vitest';
import { createEventBus, matchesPattern } from './events';

describe('matchesPattern', () => {
  it.each([
    ['*', 'record.created', true],
    ['record.*', 'record.created', true],
    ['record.*', 'record.tag.added', true],
    ['record.*', 'task.completed', false],
    ['record.created', 'record.created', true],
    ['record.created', 'record.deleted', false],
  ])('pattern %s vs %s -> %s', (pattern, type, expected) => {
    expect(matchesPattern(pattern, type)).toBe(expected);
  });
});

describe('createEventBus', () => {
  it('delivers events to matching subscribers with envelope fields', () => {
    const bus = createEventBus();
    const seen = vi.fn();
    bus.on('record.*', seen);
    bus.emit('record.created', { id: '1' }, 'core');
    expect(seen).toHaveBeenCalledOnce();
    const event = seen.mock.calls[0]![0];
    expect(event.type).toBe('record.created');
    expect(event.payload).toEqual({ id: '1' });
    expect(event.source).toBe('core');
  });

  it('does not deliver to non-matching subscribers', () => {
    const bus = createEventBus();
    const seen = vi.fn();
    bus.on('task.*', seen);
    bus.emit('record.created', {}, 'core');
    expect(seen).not.toHaveBeenCalled();
  });

  it('unsubscribes', () => {
    const bus = createEventBus();
    const seen = vi.fn();
    const off = bus.on('*', seen);
    off();
    bus.emit('record.created', {}, 'core');
    expect(seen).not.toHaveBeenCalled();
  });

  it('isolates handler errors from other subscribers', () => {
    const errors = vi.fn();
    const bus = createEventBus(errors);
    const healthy = vi.fn();
    bus.on('*', () => {
      throw new Error('boom');
    });
    bus.on('*', healthy);
    bus.emit('record.created', {}, 'core');
    expect(healthy).toHaveBeenCalledOnce();
    expect(errors).toHaveBeenCalledOnce();
  });
});
