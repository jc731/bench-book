import type { Game } from '../core/types';
import { popUndo, pushUndo, type UndoEntry } from './undo-stack';

export interface GameState {
  game: Game | null;
  stack: UndoEntry<Game>[];
  /** Steps undone since the last edit, newest last. A new edit forks the history and clears it. */
  redo?: UndoEntry<Game>[];
}

/** Drops the export marks: the files on the device no longer match the game. */
function staleExports(g: Game): Game {
  if (!g.exported) return g;
  const { exported: _was, ...rest } = g;
  return rest;
}

/**
 * `undoable: false` records a fact rather than an edit (a file was saved, a check draft): it adds no
 * undo step and leaves the export marks alone. Every edit, by contrast, can change what a CSV holds
 * (plays, a Reopen, a check or note), so it drops the marks, and the files read "not saved" again.
 */
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
  if (!undoable) return { ...state, game: next };
  return { game: staleExports(next), stack: pushUndo(state.stack, { snapshot: state.game, label }), redo: [] };
}

/** A snapshot restored by Undo or Redo: its export marks dropped, the current check drafts kept. */
function restore(snapshot: Game, current: Game | null): Game {
  const { exported: _was, checkDrafts: _drafts, ...rest } = snapshot;
  const checkDrafts = current?.checkDrafts;
  return { ...rest, ...(checkDrafts ? { checkDrafts } : {}) };
}

/**
 * Undo restores the snapshot, with two exceptions. Check drafts carry over from the current game, since
 * Later is not undoable. Export marks are dropped: an undo is an edit too, so a file saved before it no
 * longer matches the game. That errs toward "not saved" even when the undo lands back on the exported
 * state, because exporting again costs a tap and a wrong "saved" costs the plays.
 */
export function applyUndo(state: GameState): { state: GameState; label: string | null } {
  const { entry, stack } = popUndo(state.stack);
  if (!entry || !state.game) return { state, label: null };
  const redo = pushUndo(state.redo ?? [], { snapshot: state.game, label: entry.label });
  return { state: { game: restore(entry.snapshot, state.game), stack, redo }, label: entry.label };
}

/**
 * Steps forward again over an Undo, with the same rules: export marks dropped, drafts kept. The step
 * goes back on the undo stack under its own label, so Undo after Redo undoes it again.
 */
export function applyRedo(state: GameState): { state: GameState; label: string | null } {
  const { entry, stack: redo } = popUndo(state.redo ?? []);
  if (!entry || !state.game) return { state, label: null };
  const stack = pushUndo(state.stack, { snapshot: state.game, label: entry.label });
  return { state: { game: restore(entry.snapshot, state.game), stack, redo }, label: entry.label };
}
