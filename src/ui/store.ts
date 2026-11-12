import { useCallback, useRef, useState } from 'preact/hooks';
import { clearGame, loadGame, saveGame } from '../core/storage';
import type { Game } from '../core/types';
import { applyRedo, applyUndo, applyUpdate, type GameState } from './game-state';
import type { Toast } from './live-logic';
import { resumeText } from './log-logic';

export type View = 'setup' | 'live' | 'log' | 'running' | 'reconcile' | 'end' | 'howto';
export type { Toast } from './live-logic';

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
  const [reconcilePeriod, setReconcilePeriod] = useState<number | null>(null);
  const [reconcileReturn, setReconcileReturn] = useState<View>('live');
  const [howtoReturn, setHowtoReturn] = useState<View>('live');
  // Opening on a saved game with plays says where it left off, once.
  const [toast, setToast] = useState<Toast | null>(() => {
    const text = state.current.game ? resumeText(state.current.game) : null;
    return text ? { text, canUndo: false } : null;
  });
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

  /** `undoable: false` is for facts, not edits (a file was saved): no undo step and no Undo on the feedback line. */
  const update = useCallback(
    (fn: (g: Game, now: Date) => Game, label: string, opts: { undoable?: boolean } = {}) => {
      if (!state.current.game) return;
      const undoable = opts.undoable ?? true;
      const next = applyUpdate(state.current, fn, label, new Date(), undoable);
      if (next === state.current) return; // no change, so no feedback either
      commit(next);
      setToast({ text: label, canUndo: undoable });
    },
    [commit],
  );

  /** A change that is neither an edit nor news (a check draft): no undo step and no feedback. */
  const quiet = useCallback(
    (fn: (g: Game, now: Date) => Game) => {
      if (!state.current.game) return;
      const next = applyUpdate(state.current, fn, '', new Date(), false);
      if (next !== state.current) commit(next);
    },
    [commit],
  );

  const undo = useCallback((): string | null => {
    const r = applyUndo(state.current);
    if (r.label === null) return null;
    commit(r.state);
    setToast({ text: 'Undid ' + r.label, canUndo: false, canRedo: true });
    return r.label;
  }, [commit]);

  /** Steps forward over the last Undo. Offered only on the line an Undo just left, until the next edit. */
  const redo = useCallback((): string | null => {
    const r = applyRedo(state.current);
    if (r.label === null) return null;
    commit(r.state);
    setToast({ text: 'Redid ' + r.label, canUndo: true, canRedo: (r.state.redo?.length ?? 0) > 0 });
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
    setReconcilePeriod(null);
    setView('setup');
  }, [storage]);

  /** Opens Reconcile for a period; Later and Save come back to `from`. */
  const openReconcile = useCallback((period: number, from: View) => {
    setReconcilePeriod(period);
    setReconcileReturn(from);
    setView('reconcile');
  }, []);

  /** Opens the How-to; Back returns to `from`. Only the view changes: the game and its Undo stay. */
  const openHowto = useCallback((from: View) => {
    setHowtoReturn(from);
    setView('howto');
  }, []);

  const canUndo = state.current.stack.length > 0;

  return {
    game, saving, view, setView, update, quiet, undo, redo, canUndo, toast, start, discard,
    reconcilePeriod, setReconcilePeriod, reconcileReturn, openReconcile, howtoReturn, openHowto,
  };
}

export type GameStore = ReturnType<typeof useGameStore>;
