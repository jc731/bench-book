import { Workbox } from 'workbox-window';

/**
 * Service-worker update signal. The worker never reloads a page by itself:
 * a waiting update only sets `waiting`, and the Setup screen offers the reload.
 * We use workbox-window directly (not the plugin's registerSW) because that runtime
 * reloads every tab when any tab applies the update, which would interrupt a game.
 */
let waiting = false;
let wb: Workbox | null = null;
const listeners = new Set<() => void>();

export function registerUpdates(): void {
  if (wb || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  wb = new Workbox('/sw.js');
  wb.addEventListener('waiting', () => {
    waiting = true;
    listeners.forEach((l) => l());
  });
  void wb.register();
}

export function updateWaiting(): boolean {
  return waiting;
}

export function onUpdateWaiting(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Activates the waiting worker and reloads THIS tab only. Call only from an explicit tap. */
export function applyUpdate(): void {
  if (!wb) return;
  // Added at tap time, so tabs that did not tap never carry a reload listener.
  wb.addEventListener('controlling', () => window.location.reload());
  wb.messageSkipWaiting();
}
