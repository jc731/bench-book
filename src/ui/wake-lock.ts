import { useEffect } from 'preact/hooks';

/*
 * Keeps the screen on while `active` (a live game). Uses the Screen Wake Lock API where the
 * browser has it (Chrome on Android; Safari 16.4+, and in home-screen apps from iOS 18.4) and
 * does nothing where it does not. The browser drops the lock whenever the page is hidden, so it
 * is asked for again each time the page comes back.
 */
interface Sentinel { release(): Promise<void> }
interface WakeLockNav { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } }

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const api = (navigator as WakeLockNav).wakeLock;
    if (!active || !api) return;
    let sentinel: Sentinel | null = null;
    let stopped = false;
    const request = () => {
      if (document.visibilityState !== 'visible') return;
      api.request('screen').then(
        (s) => {
          if (stopped) void s.release();
          else sentinel = s;
        },
        () => {}, // refused (battery saver, no user gesture yet): the screen just sleeps as usual
      );
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', request);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
