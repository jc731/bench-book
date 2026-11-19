/** Demo mode lives only in the address: `?demo` uses demo storage, no `?demo` the real one. */
export function isDemo(search: string): boolean {
  return new URLSearchParams(search).has('demo');
}

export interface StorageKeys {
  game: string;
  roster: string;
  prefs: string;
  /** Per-game usage records live at `usagePrefix + gameId` (D7). */
  usagePrefix: string;
}

/**
 * Game data, rosters and prefs get their own keys in demo, so a demo can never overwrite a real saved
 * roster or a game in progress. App-level state (the service worker, its update signal) is not stored
 * under these and is shared on purpose.
 */
export function storageKeys(demo: boolean): StorageKeys {
  const p = demo ? 'benchbook-demo' : 'benchbook';
  return { game: `${p}:game`, roster: `${p}:roster`, prefs: `${p}:prefs`, usagePrefix: `${p}:usage:` };
}
