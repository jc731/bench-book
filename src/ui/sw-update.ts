import { registerSW } from 'virtual:pwa-register';

/**
 * Service-worker update signal. The worker never reloads the page by itself:
 * a waiting update only sets `waiting`, and the Setup screen offers the reload.
 */
let waiting = false;
let apply: ((reloadPage?: boolean) => Promise<void>) | null = null;
const listeners = new Set<() => void>();

export function registerUpdates(): void {
  if (apply || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  apply = registerSW({
    onNeedRefresh() {
      waiting = true;
      listeners.forEach((l) => l());
    },
  });
}

export function updateWaiting(): boolean {
  return waiting;
}

export function onUpdateWaiting(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Activates the waiting worker and reloads the page. Call only from an explicit tap. */
export function applyUpdate(): void {
  void apply?.(true);
}
