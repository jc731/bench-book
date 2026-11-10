import { useCallback, useRef, useState } from 'preact/hooks';
import { clearGame, loadGame, saveGame } from '../core/storage';
import type { Game } from '../core/types';
import { applyUndo, applyUpdate, type GameState } from './game-state';

export type View = 'setup' | 'live' | 'log' | 'running' | 'reconcile' | 'end';
export type Toast = { text: string; canUndo: boolean };

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

let shared: { storage: Storage; persistent: boolean } | null = null;

/** localStorage when reachable, else an in-memory stand-in (nothing survives a reload). */
export function getStorage(): { storage: Storage; persistent: boolean } {
  if (!shared) {
    try {
      shared = { storage: window.localStorage, persistent: true };
    } catch {
      shared = { storage: memoryStorage(), persistent: false };
    }
  }
  return shared;
}

export function useGameStore() {
  const [{ storage, persistent }] = useState(getStorage);
  const state = useRef<GameState>({ game: loadGame(storage, new Date()), stack: [] });
  const [game, setGame] = useState<Game | null>(state.current.game);
  const [saving, setSaving] = useState(persistent);
  const [view, setView] = useState<View>(() => (state.current.game ? 'live' : 'setup'));
  const [toast, setToast] = useState<Toast | null>(null);
  const persistAsked = useRef(false);

  // The ref is the source of truth; state only mirrors it for rendering.
  const commit = useCallback(
    (next: GameState) => {
      state.current = next;
      setGame(next.game);
      if (next.game) setSaving(persistent && saveGame(storage, next.game));
    },
    [storage, persistent],
  );

  const update = useCallback(
    (fn: (g: Game, now: Date) => Game, label: string) => {
      if (!state.current.game) return;
      commit(applyUpdate(state.current, fn, label, new Date()));
      setToast({ text: label, canUndo: true });
    },
    [commit],
  );

  const undo = useCallback((): string | null => {
    const r = applyUndo(state.current);
    if (r.label === null) return null;
    commit(r.state);
    setToast({ text: 'Undid ' + r.label, canUndo: false });
    return r.label;
  }, [commit]);

  const start = useCallback(
    (g: Game) => {
      commit({ game: g, stack: [] });
      setToast(null);
      setView('live');
      if (!persistAsked.current) {
        persistAsked.current = true;
        try {
          void navigator.storage?.persist?.();
        } catch {
          /* ignore */
        }
      }
    },
    [commit],
  );

  const discard = useCallback(() => {
    clearGame(storage);
    state.current = { game: null, stack: [] };
    setGame(null);
    setToast(null);
    setView('setup');
  }, [storage]);

  const clearToast = useCallback(() => setToast(null), []);

  return { game, saving, view, setView, update, undo, toast, clearToast, start, discard };
}

export type GameStore = ReturnType<typeof useGameStore>;
