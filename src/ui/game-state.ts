import type { Game } from '../core/types';
import { popUndo, pushUndo, type UndoEntry } from './undo-stack';

export interface GameState {
  game: Game | null;
  stack: UndoEntry<Game>[];
}

/** `undoable: false` records a fact rather than an edit (a file was saved): it adds no undo step. */
export function applyUpdate(
  state: GameState,
  fn: (g: Game, now: Date) => Game,
  label: string,
  now: Date,
  undoable = true,
): GameState {
  if (!state.game) return state;
  const next = fn(state.game, now);
  if (next === state.game) return state; // nothing changed: no undo step
  return {
    game: next,
    stack: undoable ? pushUndo(state.stack, { snapshot: state.game, label }) : state.stack,
  };
}

/** Undo restores the snapshot, but a file already downloaded stays downloaded, so export marks carry over. */
export function applyUndo(state: GameState): { state: GameState; label: string | null } {
  const { entry, stack } = popUndo(state.stack);
  if (!entry) return { state, label: null };
  const { exported: _was, ...snapshot } = entry.snapshot;
  const exported = state.game?.exported;
  const game: Game = exported ? { ...snapshot, exported } : snapshot;
  return { state: { game, stack }, label: entry.label };
}
