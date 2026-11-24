import { useEffect, useRef } from 'preact/hooks';
import { BUZZ, alertBetween, closeDue, type Clock } from './clock-logic';

/**
 * Buzzes at the timeout clock's warning point and at 0, and closes it CLOSE_AFTER_MS after 0 (owner,
 * 2026-11-24). Mounted at the app root, so it works on every view, not only Live where the band shows.
 * Uses the Vibration API, which Android browsers have and iPhone does not; there it is silent.
 */
export function useClockAlerts(clock: Clock | null, setClock: (c: Clock | null) => void): void {
  const last = useRef(0);
  useEffect(() => {
    if (!clock || clock.endsAt === null) return;
    last.current = Date.now();
    const t = setInterval(() => {
      const now = Date.now();
      const alert = alertBetween(clock, last.current, now);
      last.current = now;
      if (alert && typeof navigator.vibrate === 'function') navigator.vibrate(BUZZ[alert]);
      if (closeDue(clock, now)) setClock(null);
    }, 250);
    return () => clearInterval(t);
  }, [clock, setClock]);
}
