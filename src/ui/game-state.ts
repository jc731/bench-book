import type { Game } from '../core/types';
import { popUndo, pushUndo, type UndoEntry } from './undo-stack';

export interface GameState {
  game: Game | null;
  stack: UndoEntry<Game>[];
}

export function applyUpdate(
  state: GameState,
  fn: (g: Game, now: Date) => Game,
  label: string,
  now: Date,
): GameState {
  if (!state.game) return state;
  const next = fn(state.game, now);
  if (next === state.game) return state; // nothing changed: no undo step
  return {
    game: next,
    stack: pushUndo(state.stack, { snapshot: state.game, label }),
  };
}

export function applyUndo(state: GameState): { state: GameState; label: string | null } {
  const { entry, stack } = popUndo(state.stack);
  if (!entry) return { state, label: null };
  return { state: { game: entry.snapshot, stack }, label: entry.label };
}
