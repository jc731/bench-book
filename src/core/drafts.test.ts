import { describe, expect, test } from 'vitest';
import { appendEvent, newGame } from './events';
import { checkDraftFor, checkSeed, sawMismatch, setCheckDraft } from './drafts';
import { bookCsv } from './export-book';
import { checkPeriod, openIssues, saveReconcile } from './reconcile';
import { loadGame, saveGame } from './storage';
import type { Game, GameInfo, Player } from './types';

const info: GameInfo = {
  team: 'Team A', opponent: 'Team B', date: '2026-11-10', homeAway: 'home',
  coach: '', scorer: '', timer: '',
};
const roster: Player[] = [{ id: 'p1', number: '1', name: 'Player One', pos: 'G' }];
const t0 = new Date('2026-11-10T10:00:00Z');
const t1 = new Date('2026-11-10T10:30:00Z');

// Q1 ended with app at 8 (four FG2), opponent taps on with 6 tapped; now in Q2.
function eightInQ1(): Game {
  let g: Game = { ...newGame(info, roster, t0), trackOpponentTaps: true };
  for (let i = 0; i < 4; i++) g = appendEvent(g, { type: 'FG2', playerId: 'p1' }, t0);
  g = appendEvent(g, { type: 'OPP_PTS', oppPoints: 3 }, t0);
  g = appendEvent(g, { type: 'OPP_PTS', oppPoints: 3 }, t0);
  return { ...g, currentPeriod: 2 };
}

class MemStorage implements Storage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

describe('check drafts', () => {
  test('Later with typed values stores a draft that reopening restores', () => {
    const g = setCheckDraft(eightInQ1(), 1, { us: '9', opp: '6', note: 'look again', appAtOpen: 8 }, t1);
    expect(checkDraftFor(g, 1)).toEqual({ us: '9', opp: '6', note: 'look again', appAtOpen: 8 });
    expect(checkSeed(g, 1)).toEqual({ us: '9', opp: '6', note: 'look again', appAtOpen: 8 });
  });

  test('with no draft, the seed comes from the saved record and the app count now', () => {
    const g = saveReconcile(eightInQ1(), 1, 8, 6, 'ok', t1);
    expect(checkSeed(g, 1)).toEqual({ us: '8', opp: '6', note: 'ok', appAtOpen: 8 });
    expect(checkSeed(eightInQ1(), 1)).toEqual({ us: '', opp: '', note: '', appAtOpen: 8 });
  });

  test('all fields empty stores nothing and clears an earlier draft', () => {
    const empty = setCheckDraft(eightInQ1(), 1, { us: ' ', opp: '', note: '', appAtOpen: 8 }, t1);
    expect(checkDraftFor(empty, 1)).toBeNull();
    const had = setCheckDraft(eightInQ1(), 1, { us: '9', opp: '', note: '', appAtOpen: 8 }, t1);
    const cleared = setCheckDraft(had, 1, { us: '', opp: '', note: '', appAtOpen: 8 }, t1);
    expect(checkDraftFor(cleared, 1)).toBeNull();
    expect(setCheckDraft(had, 1, null, t1).checkDrafts?.[1]).toBeUndefined();
  });

  test('fields equal to the saved record are not a draft', () => {
    const g = saveReconcile(eightInQ1(), 1, 8, 6, '', t1);
    expect(checkDraftFor(setCheckDraft(g, 1, { us: '8', opp: '6', note: '', appAtOpen: 8 }, t1), 1)).toBeNull();
  });

  test('a draft is not a check: still Not checked, still an open issue', () => {
    const g = setCheckDraft(eightInQ1(), 1, { us: '8', opp: '6', note: 'n', appAtOpen: 8 }, t1);
    expect(checkPeriod(g, 1).status).toBe('pending');
    expect(openIssues(g).map((i) => i.period)).toEqual([1]);
  });

  test('the Book CSV ignores drafts: same file, opponent still starred from taps', () => {
    const g = eightInQ1();
    const drafted = setCheckDraft(g, 1, { us: '9', opp: '7', note: 'draft note', appAtOpen: 8 }, t1);
    const csv = bookCsv(drafted);
    expect(csv).toBe(bookCsv({ ...drafted, checkDrafts: undefined }));
    expect(csv).not.toContain('draft note');
    expect(csv).toContain('Team B,6*,');
  });

  test('Fixed survives a Later: book 9 vs app 8, add the play, Later, reopen, Save', () => {
    let g = eightInQ1();
    const opened = checkSeed(g, 1); // first open: app 8
    g = appendEvent(g, { type: 'FTM', playerId: 'p1', period: 1 }, t1); // the missing FT: app 9
    g = setCheckDraft(g, 1, { us: '9', opp: '', note: '', appAtOpen: opened.appAtOpen }, t1); // Later
    const reopened = checkSeed(g, 1);
    expect(reopened).toMatchObject({ us: '9', appAtOpen: 8 });
    expect(checkPeriod(g, 1).appUs).toBe(9);
    g = saveReconcile(g, 1, 9, null, '', t1, sawMismatch(9, reopened.appAtOpen));
    expect(checkPeriod(g, 1).status).toBe('fixed');
  });

  test('Save clears the draft for that quarter only', () => {
    let g = setCheckDraft(eightInQ1(), 1, { us: '9', opp: '', note: '', appAtOpen: 8 }, t1);
    g = setCheckDraft(g, 2, { us: '4', opp: '', note: '', appAtOpen: 0 }, t1);
    g = saveReconcile(g, 1, 9, null, '', t1);
    expect(checkDraftFor(g, 1)).toBeNull();
    expect(checkDraftFor(g, 2)).not.toBeNull();
  });

  test('a draft survives a save and reload; a game without drafts still loads', () => {
    const s = new MemStorage();
    saveGame(s, setCheckDraft(eightInQ1(), 1, { us: '9', opp: '', note: '', appAtOpen: 8 }, t1));
    expect(checkDraftFor(loadGame(s, t1)!, 1)).toMatchObject({ us: '9', appAtOpen: 8 });
    saveGame(s, eightInQ1());
    expect(checkDraftFor(loadGame(s, t1)!, 1)).toBeNull();
  });
});
