import { describe, expect, it } from 'vitest';
import { newGame } from '../core/events';
import { markExported } from '../core/reconcile';
import type { Game, GameInfo } from '../core/types';
import { applyUndo, applyUpdate, type GameState } from './game-state';

const info: GameInfo = { team: '', opponent: 'Test', date: '2026-11-10', homeAway: 'home', coach: '', scorer: '', timer: '' };
const now = new Date('2026-11-10T12:00:00Z');
const base = newGame(info, [], now);
const setOpp = (o: string) => (g: Game): Game => ({ ...g, info: { ...g.info, opponent: o } });

describe('game state transitions', () => {
  it('two consecutive updates both land and undo restores in order', () => {
    let s: GameState = { game: base, stack: [] };
    s = applyUpdate(s, (g) => ({ ...g, currentPeriod: g.currentPeriod + 1 }), 'a', now);
    s = applyUpdate(s, (g) => ({ ...g, currentPeriod: g.currentPeriod + 1 }), 'b', now);
    expect(s.game?.currentPeriod).toBe(3);
    const u1 = applyUndo(s);
    expect(u1.label).toBe('b');
    expect(u1.state.game?.currentPeriod).toBe(2);
    const u2 = applyUndo(u1.state);
    expect(u2.label).toBe('a');
    expect(u2.state.game).toEqual(base);
  });

  it('an update after an undo applies to the undone game', () => {
    let s: GameState = { game: base, stack: [] };
    s = applyUpdate(s, setOpp('X'), 'x', now);
    s = applyUndo(s).state;
    s = applyUpdate(s, (g) => ({ ...g, currentPeriod: 2 }), 'p', now);
    expect(s.game?.info.opponent).toBe('Test');
    expect(s.game?.currentPeriod).toBe(2);
  });

  it('undo on empty stack returns null label and same state; update with no game is a no-op', () => {
    const s: GameState = { game: base, stack: [] };
    expect(applyUndo(s)).toEqual({ state: s, label: null });
    const none: GameState = { game: null, stack: [] };
    expect(applyUpdate(none, setOpp('Y'), 'y', now)).toBe(none);
  });

  it('an update that returns the same game pushes no undo step', () => {
    const s: GameState = { game: base, stack: [] };
    expect(applyUpdate(s, (g) => g, 'same', now)).toBe(s);
  });
});

describe('export marks', () => {
  it('a non-undoable update adds no undo step', () => {
    let s: GameState = { game: base, stack: [] };
    s = applyUpdate(s, (g, t) => markExported(g, 'book', t), 'Exported Book CSV', now, false);
    expect(s.game?.exported?.book).toBe(now.toISOString());
    expect(s.stack).toHaveLength(0);
  });
  it('undoing an edit made before an export keeps the export marks', () => {
    let s: GameState = { game: base, stack: [] };
    s = applyUpdate(s, setOpp('X'), 'x', now);
    s = applyUpdate(s, (g, t) => markExported(g, 'plays', t), 'Exported Plays CSV', now, false);
    const u = applyUndo(s);
    expect(u.label).toBe('x');
    expect(u.state.game?.info.opponent).toBe('Test');
    expect(u.state.game?.exported).toEqual({ plays: now.toISOString() });
  });
});
