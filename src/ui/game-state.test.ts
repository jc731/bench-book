import { describe, expect, it } from 'vitest';
import { appendEvent, deleteEvent, editEvent, moveFrom, newGame } from '../core/events';
import { endGame, isExported, markExported, reopenGame, saveReconcile } from '../core/reconcile';
import type { Game, GameInfo } from '../core/types';
import { applyRedo, applyUndo, applyUpdate, type GameState } from './game-state';

const info: GameInfo = { team: '', opponent: 'Test', date: '2026-11-10', homeAway: 'home', coach: '', scorer: '', timer: '' };
const now = new Date('2026-11-10T12:00:00Z');
const base = newGame(info, [], now);
const exportBoth = (g: Game, t: Date): Game => markExported(markExported(g, 'book', t), 'plays', t);
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
  it('undoing an edit made before an export drops the marks: the files no longer match the game', () => {
    let s: GameState = { game: base, stack: [] };
    s = applyUpdate(s, setOpp('X'), 'x', now);
    s = applyUpdate(s, exportBoth, 'Exported both', now, false);
    const u = applyUndo(s);
    expect(u.label).toBe('x');
    expect(u.state.game?.info.opponent).toBe('Test');
    expect(u.state.game?.exported).toBeUndefined();
    expect(isExported(u.state.game!)).toBe(false);
  });
});

describe('an export counts only until the game changes after it', () => {
  const exported = (): GameState => applyUpdate({ game: base, stack: [] }, exportBoth, 'Exported both', now, false);
  const later = new Date('2026-11-10T12:05:00Z');
  const ended = (): GameState => applyUpdate({ game: endGame(base, now), stack: [] }, exportBoth, 'Exported both', now, false);

  it('both exports count while nothing has changed since', () => {
    expect(isExported(exported().game!)).toBe(true);
  });
  it('adding a play after the export marks both files not saved', () => {
    const s = applyUpdate(exported(), (g, t) => appendEvent(g, { type: 'TIMEOUT', timeoutKind: 'full' }, t), 'TO', later);
    expect(s.game?.exported).toBeUndefined();
    expect(isExported(s.game!)).toBe(false);
  });
  it('editing, deleting or moving a play after the export marks the files not saved', () => {
    const withPlay = applyUpdate({ game: base, stack: [] }, (g, t) => appendEvent(g, { type: 'TIMEOUT', timeoutKind: 'full' }, t), 'TO', now);
    const s0 = applyUpdate(withPlay, exportBoth, 'Exported both', now, false);
    const id = s0.game!.events[0].id;
    expect(isExported(s0.game!)).toBe(true);
    expect(applyUpdate(s0, (g, t) => editEvent(g, id, { timeoutKind: 'thirty' }, t), 'edit', later).game?.exported).toBeUndefined();
    expect(applyUpdate(s0, (g, t) => deleteEvent(g, id, t), 'del', later).game?.exported).toBeUndefined();
    expect(applyUpdate(s0, (g, t) => moveFrom(g, id, 2, t), 'move', later).game?.exported).toBeUndefined();
  });
  it('Reopen after the export marks the files not saved, and ending again does not bring them back', () => {
    let s = applyUpdate(ended(), (g, t) => reopenGame(g, t), 'Reopened game', later);
    expect(s.game?.exported).toBeUndefined();
    s = applyUpdate(s, (g, t) => endGame(g, t), 'End game', later);
    expect(isExported(s.game!)).toBe(false);
  });
  it('saving a check after the export marks the files not saved (the Book CSV holds the checks)', () => {
    const s = applyUpdate(ended(), (g, t) => saveReconcile(g, 1, 0, null, 'late note', t), 'Noted Q1', later);
    expect(s.game?.exported).toBeUndefined();
  });
  it('a check draft or another export is not a change to the files', () => {
    const draft = { us: '9', opp: '', note: '', appSpanAtOpen: 8 };
    let s = applyUpdate(exported(), (g) => ({ ...g, checkDrafts: { 1: draft } }), '', later, false);
    expect(isExported(s.game!)).toBe(true);
    s = applyUpdate(s, (g, t) => markExported(g, 'book', t), 'Exported Book CSV', later, false);
    expect(s.game?.exported).toEqual({ book: later.toISOString(), plays: now.toISOString() });
  });
  it('undoing an edit made after the export still reads not saved: undo errs toward exporting again', () => {
    let s = applyUpdate(exported(), (g, t) => appendEvent(g, { type: 'TIMEOUT', timeoutKind: 'full' }, t), 'TO', later);
    s = applyUndo(s).state;
    expect(s.game?.events).toHaveLength(0);
    expect(s.game?.exported).toBeUndefined();
    expect(isExported(s.game!)).toBe(false);
  });
});

describe('check drafts and undo', () => {
  it('undo neither brings back nor drops a draft', () => {
    const draft = { us: '9', opp: '', note: '', appSpanAtOpen: 8 };
    let s: GameState = { game: base, stack: [] };
    s = applyUpdate(s, setOpp('X'), 'x', now);
    s = applyUpdate(s, (g) => ({ ...g, checkDrafts: { 1: draft } }), 'draft', now, false);
    expect(applyUndo(s).state.game?.checkDrafts).toEqual({ 1: draft });
    // A draft present in the snapshot but cleared since stays cleared.
    let t: GameState = { game: { ...base, checkDrafts: { 1: draft } }, stack: [] };
    t = applyUpdate(t, setOpp('Y'), 'y', now);
    t = applyUpdate(t, (g) => ({ ...g, checkDrafts: undefined }), 'clear', now, false);
    expect(applyUndo(t).state.game?.checkDrafts).toBeUndefined();
  });
});

describe('redo', () => {
  const step = (n: number) => (g: Game): Game => ({ ...g, currentPeriod: n });
  const five = (): GameState => {
    let s: GameState = { game: base, stack: [] };
    for (let n = 2; n <= 6; n++) s = applyUpdate(s, step(n), `p${n}`, now);
    return s;
  };

  it('undo five times then redo once lands one step forward, with that step\'s label', () => {
    let s = five();
    for (let i = 0; i < 5; i++) s = applyUndo(s).state;
    expect(s.game?.currentPeriod).toBe(1);
    const r = applyRedo(s);
    expect(r.label).toBe('p2');
    expect(r.state.game?.currentPeriod).toBe(2);
  });
  it('redo walks forward in order and stops at the newest state', () => {
    let s = five();
    for (let i = 0; i < 3; i++) s = applyUndo(s).state;
    expect(s.game?.currentPeriod).toBe(3);
    s = applyRedo(s).state;
    s = applyRedo(s).state;
    expect(s.game?.currentPeriod).toBe(5);
    s = applyRedo(s).state;
    expect(s.game?.currentPeriod).toBe(6);
    const end = applyRedo(s);
    expect(end.label).toBeNull();
    expect(end.state).toBe(s);
  });
  it('undo after redo undoes the redone step again', () => {
    let s = applyUndo(five()).state;
    s = applyRedo(s).state;
    const u = applyUndo(s);
    expect(u.label).toBe('p6');
    expect(u.state.game?.currentPeriod).toBe(5);
  });
  it('a new edit after an undo forks the history: nothing left to redo', () => {
    let s = applyUndo(five()).state;
    s = applyUpdate(s, setOpp('X'), 'x', now);
    expect(applyRedo(s).label).toBeNull();
  });
  it('a fact (an export) does not fork the history, and redo drops the export marks it made stale', () => {
    let s = applyUndo(five()).state;
    s = applyUpdate(s, exportBoth, 'Exported both', now, false);
    const r = applyRedo(s);
    expect(r.label).toBe('p6');
    expect(r.state.game?.exported).toBeUndefined();
  });
  it('redo keeps check drafts left after the undo', () => {
    let s = applyUndo(five()).state;
    const draft = { us: '9', opp: '', note: '', appSpanAtOpen: 0 };
    s = applyUpdate(s, (g) => ({ ...g, checkDrafts: { 1: draft } }), '', now, false);
    expect(applyRedo(s).state.game?.checkDrafts).toEqual({ 1: draft });
  });
});
