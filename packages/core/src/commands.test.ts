import { describe, expect, it, vi } from 'vitest';
import { createCommandRegistry } from './commands';
import { createEventBus } from './events';

function fixture() {
  const bus = createEventBus();
  return { bus, registry: createCommandRegistry({ bus }) };
}

describe('command registry', () => {
  it('registers, lists sorted by title, and unregisters', () => {
    const { registry } = fixture();
    const off = registry.register({ id: 'a.z', title: 'Zeta', moduleId: 'a', run: () => {} });
    registry.register({ id: 'a.a', title: 'Alpha', moduleId: 'a', run: () => {} });

    expect(registry.list().map((c) => c.title)).toEqual(['Alpha', 'Zeta']);
    off();
    expect(registry.list().map((c) => c.id)).toEqual(['a.a']);
  });

  it('rejects duplicate ids', () => {
    const { registry } = fixture();
    registry.register({ id: 'a.x', title: 'X', moduleId: 'a', run: () => {} });
    expect(() =>
      registry.register({ id: 'a.x', title: 'X again', moduleId: 'a', run: () => {} }),
    ).toThrow(/already registered/);
  });

  it('executes commands and emits command.executed', async () => {
    const { registry, bus } = fixture();
    const seen = vi.fn();
    bus.on('command.executed', seen);
    const run = vi.fn();
    registry.register({ id: 'a.go', title: 'Go', moduleId: 'a', run });

    await registry.execute('a.go');
    expect(run).toHaveBeenCalledOnce();
    expect(seen.mock.calls[0]![0].payload).toEqual({ id: 'a.go' });
  });

  it('throws for unknown command ids', async () => {
    const { registry } = fixture();
    await expect(registry.execute('nope')).rejects.toThrow(/unknown command/);
  });
});
