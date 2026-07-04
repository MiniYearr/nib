import { describe, expect, it } from 'vitest';
import { compareHlc, createHlcClock, encodeHlc, parseHlc } from './hlc';

describe('hlc', () => {
  it('round-trips through encode/parse', () => {
    const encoded = encodeHlc(1720000000000, 42, 'device-a');
    expect(parseHlc(encoded)).toEqual({ ms: 1720000000000, counter: 42, deviceId: 'device-a' });
  });

  it('orders by string comparison across ms and counter', () => {
    const earlier = encodeHlc(1000, 0xffff, 'z');
    const later = encodeHlc(1001, 0, 'a');
    expect(compareHlc(earlier, later)).toBe(-1);
    expect(compareHlc(encodeHlc(1000, 1, 'a'), encodeHlc(1000, 2, 'a'))).toBe(-1);
  });

  it('stays strictly monotonic within one millisecond', () => {
    const clock = createHlcClock('dev', () => 5000);
    const a = clock.next();
    const b = clock.next();
    const c = clock.next();
    expect(compareHlc(a, b)).toBe(-1);
    expect(compareHlc(b, c)).toBe(-1);
  });

  it('stays monotonic when the wall clock goes backwards', () => {
    let wall = 5000;
    const clock = createHlcClock('dev', () => wall);
    const a = clock.next();
    wall = 4000;
    const b = clock.next();
    expect(compareHlc(a, b)).toBe(-1);
    expect(parseHlc(b).ms).toBe(5000);
  });

  it('advances past an observed remote timestamp', () => {
    const clock = createHlcClock('local', () => 1000);
    clock.observe(encodeHlc(9999, 7, 'remote'));
    const next = clock.next();
    expect(compareHlc(encodeHlc(9999, 7, 'remote'), next)).toBe(-1);
  });

  it('rolls over to the next millisecond when the counter saturates', () => {
    const clock = createHlcClock('dev', () => 1000);
    let last = clock.next();
    for (let i = 0; i < 0x10000; i += 1) {
      const current = clock.next();
      expect(compareHlc(last, current)).toBe(-1);
      last = current;
    }
    expect(parseHlc(last).ms).toBe(1001);
  });
});
