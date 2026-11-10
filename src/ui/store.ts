import { useCallback, useRef, useState } from 'preact/hooks';
import { clearGame, loadGame, saveGame } from '../core/storage';
import type { Game } from '../core/types';
import { popUndo, pushUndo, type UndoEntry } from './undo-stack';

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
  const [game, setGame] = useState<Game | null>(() => loadGame(storage, new Date()));
  const [saving, setSaving] = useState(persistent);
  const [view, setView] = useState<View>(() => (game ? 'live' : 'setup'));
  const [toast, setToast] = useState<Toast | null>(null);
  const stack = useRef<UndoEntry<Game>[]>([]);
  const persistAsked = useRef(false);

  const persist = useCallback(
    (g: Game) => {
      setSaving(persistent && saveGame(storage, g));
    },
    [storage, persistent],
  );

  const update = useCallback(
    (fn: (g: Game, now: Date) => Game, label: string) => {
      if (!game) return;
      const next = fn(game, new Date());
      stack.current = pushUndo(stack.current, { snapshot: game, label });
      setGame(next);
      persist(next);
      setToast({ text: label, canUndo: true });
    },
    [game, persist],
  );

  const undo = useCallback((): string | null => {
    const { entry, stack: rest } = popUndo(stack.current);
    if (!entry) return null;
    stack.current = rest;
    setGame(entry.snapshot);
    persist(entry.snapshot);
    setToast({ text: 'Undid ' + entry.label, canUndo: false });
    return entry.label;
  }, [persist]);

  const start = useCallback(
    (g: Game) => {
      stack.current = [];
      setGame(g);
      persist(g);
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
    [persist],
  );

  const discard = useCallback(() => {
    clearGame(storage);
    stack.current = [];
    setGame(null);
    setToast(null);
    setView('setup');
  }, [storage]);

  const clearToast = useCallback(() => setToast(null), []);

  return { game, saving, view, setView, update, undo, toast, clearToast, start, discard };
}

export type GameStore = ReturnType<typeof useGameStore>;
