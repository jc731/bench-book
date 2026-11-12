import type { Game } from '../core/types';
import { popUndo, pushUndo, type UndoEntry } from './undo-stack';

export interface GameState {
  game: Game | null;
  stack: UndoEntry<Game>[];
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
  return {
    game: undoable ? staleExports(next) : next,
    stack: undoable ? pushUndo(state.stack, { snapshot: state.game, label }) : state.stack,
  };
}

/**
 * Undo restores the snapshot, with two exceptions. Check drafts carry over from the current game, since
 * Later is not undoable. Export marks are dropped: an undo is an edit too, so a file saved before it no
 * longer matches the game. That errs toward "not saved" even when the undo lands back on the exported
 * state, because exporting again costs a tap and a wrong "saved" costs the plays.
 */
export function applyUndo(state: GameState): { state: GameState; label: string | null } {
  const { entry, stack } = popUndo(state.stack);
  if (!entry) return { state, label: null };
  const { exported: _was, checkDrafts: _drafts, ...snapshot } = entry.snapshot;
  const checkDrafts = state.game?.checkDrafts;
  const game: Game = { ...snapshot, ...(checkDrafts ? { checkDrafts } : {}) };
  return { state: { game, stack }, label: entry.label };
}
