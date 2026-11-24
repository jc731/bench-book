import { describe, expect, it } from 'vitest';
import {
  BUZZ, CLOSE_AFTER_MS, WARN_FRACTION, alertBetween, clockLeftMs, closeDue, clockPhase, clockText, newClock, pauseClock, resetClock, startClock, warnText,
} from './clock-logic';

/* Design 2026-11-19, D16-D19 and I8. Every `now` is an explicit number of ms; nothing reads Date. */

describe('newClock (D16, D17)', () => {
  it('a 30 is 30 s, ready, not running', () => {
    const c = newClock('thirty');
    expect(c.totalMs).toBe(30_000); // D16: 30 s for a 30
    expect(c.endsAt).toBeNull(); // D17: it doesn't start by itself
    expect(clockText(clockLeftMs(c, 0))).toBe('0:30');
    expect(clockPhase(c, 0)).toBe('ready');
  });
  it('a full and an OT timeout are 60 s (D16)', () => {
    expect(newClock('full').totalMs).toBe(60_000);
    expect(newClock('ot').totalMs).toBe(60_000);
    expect(clockText(clockLeftMs(newClock('full'), 0))).toBe('1:00');
  });
});

describe('a running 30 (D18, D19, I8)', () => {
  const c = startClock(newClock('thirty'), 0);
  it('at 14 s: running, 0:16', () => {
    expect(clockPhase(c, 14_000)).toBe('running');
    expect(clockText(clockLeftMs(c, 14_000))).toBe('0:16');
  });
  it('at 15 s: warn at halfway, 0:15 (D19)', () => {
    expect(clockPhase(c, 15_000)).toBe('warn');
    expect(clockText(clockLeftMs(c, 15_000))).toBe('0:15');
  });
  it('at 31 s: time, 0:00, and left never below 0 (I8)', () => {
    expect(clockPhase(c, 31_000)).toBe('time');
    expect(clockText(clockLeftMs(c, 31_000))).toBe('0:00');
    expect(clockLeftMs(c, 31_000)).toBe(0);
    expect(clockLeftMs(c, 10_000_000)).toBe(0);
  });
  it('Review Focus 4: read later with no calls in between, it has fallen by exactly the elapsed time (D18)', () => {
    expect(clockLeftMs(c, 3_000)).toBe(27_000);
    expect(clockLeftMs(c, 3_000 + 7_250)).toBe(27_000 - 7_250);
  });
});

describe('pause and restart (D17, D18)', () => {
  it('paused time does not fall; restarted, it runs out (I8)', () => {
    const p = pauseClock(startClock(newClock('thirty'), 0), 10_000);
    expect(clockLeftMs(p, 50_000)).toBe(20_000); // 30 s less the 10 s it ran
    expect(clockPhase(p, 50_000)).toBe('paused');
    const r = startClock(p, 50_000);
    expect(clockLeftMs(r, 60_000)).toBe(10_000);
    expect(clockPhase(r, 70_000)).toBe('time');
  });
  it('paused in the last half reads warn (D19: running or paused)', () => {
    const p = pauseClock(startClock(newClock('thirty'), 0), 20_000);
    expect(clockPhase(p, 99_000)).toBe('warn');
  });
  it('pausing a paused clock and starting a running one change nothing', () => {
    const p = pauseClock(newClock('thirty'), 5_000);
    expect(clockLeftMs(p, 9_000)).toBe(30_000);
    const s = startClock(newClock('thirty'), 0);
    expect(startClock(s, 4_000)).toEqual(s);
  });
  it('a paused clock at 0 reads time', () => {
    const p = pauseClock(startClock(newClock('thirty'), 0), 40_000);
    expect(clockLeftMs(p, 41_000)).toBe(0);
    expect(clockPhase(p, 41_000)).toBe('time');
  });
});

describe('a full clock warns at 30 s left (D19)', () => {
  const c = startClock(newClock('full'), 0);
  it('29.999 s in: running; 30 s in: warn', () => {
    expect(clockPhase(c, 29_999)).toBe('running');
    expect(clockPhase(c, 30_000)).toBe('warn');
  });
  it('the note says 30 seconds for a full, 15 for a 30 (D19)', () => {
    expect(warnText(newClock('full'))).toBe('30 seconds');
    expect(warnText(newClock('ot'))).toBe('30 seconds');
    expect(warnText(newClock('thirty'))).toBe('15 seconds');
  });
  it('halfway is one constant (D19)', () => {
    expect(WARN_FRACTION).toBe(0.5);
  });
});

describe('resetClock (D17)', () => {
  it('gives full time back, not running', () => {
    const r = resetClock(startClock(newClock('full'), 0));
    expect(r.endsAt).toBeNull();
    expect(clockLeftMs(r, 90_000)).toBe(60_000);
    expect(clockPhase(r, 90_000)).toBe('ready');
  });
});

describe('clockText (m:ss, rounding up)', () => {
  it('59_001 → 1:00, 59_000 → 0:59, 1 → 0:01, 0 → 0:00', () => {
    expect(clockText(59_001)).toBe('1:00');
    expect(clockText(59_000)).toBe('0:59');
    expect(clockText(1)).toBe('0:01');
    expect(clockText(0)).toBe('0:00');
    expect(clockText(-5)).toBe('0:00');
  });
});

/* Owner, 2026-11-24: buzz at 30 s left on a full, 15 s left on a 30, and at 0; close 10 s after 0. */
describe('alertBetween: the buzz points', () => {
  const thirty = startClock(newClock('thirty'), 0); // ends at 30_000
  const full = startClock(newClock('full'), 0); // ends at 60_000

  it('a 30 buzzes warn crossing 15 s left, and only on the crossing', () => {
    expect(alertBetween(thirty, 14_750, 15_000)).toBe('warn');
    expect(alertBetween(thirty, 14_500, 14_750)).toBeNull();
    expect(alertBetween(thirty, 15_000, 15_250)).toBeNull();
  });

  it('a full buzzes warn crossing 30 s left', () => {
    expect(alertBetween(full, 29_900, 30_100)).toBe('warn');
    expect(alertBetween(full, 14_900, 15_100)).toBeNull();
  });

  it('time crossing 0, and never again after', () => {
    expect(alertBetween(thirty, 29_900, 30_100)).toBe('time');
    expect(alertBetween(thirty, 30_100, 31_000)).toBeNull();
  });

  it('a read that skips both points (the phone slept) buzzes time only', () => {
    expect(alertBetween(thirty, 1_000, 40_000)).toBe('time');
  });

  it('a paused clock crosses nothing', () => {
    expect(alertBetween(pauseClock(thirty, 10_000), 10_000, 50_000)).toBeNull();
  });

  it('time buzzes longer than warn', () => {
    const sum = (p: number[]) => p.reduce((a, b) => a + b, 0);
    expect(sum(BUZZ.time)).toBeGreaterThan(sum(BUZZ.warn));
  });
});

describe('closeDue: closes 10 s after 0', () => {
  const thirty = startClock(newClock('thirty'), 0);
  it('the constant is 10 s', () => expect(CLOSE_AFTER_MS).toBe(10_000));
  it('open at 0 and 9.999 s after; closed at 10 s after', () => {
    expect(closeDue(thirty, 30_000)).toBe(false);
    expect(closeDue(thirty, 39_999)).toBe(false);
    expect(closeDue(thirty, 40_000)).toBe(true);
  });
  it('a paused or reset clock never closes by itself', () => {
    expect(closeDue(pauseClock(thirty, 5_000), 100_000)).toBe(false);
    expect(closeDue(resetClock(thirty), 100_000)).toBe(false);
  });
});
