import { describe, expect, it } from 'vitest';
import type { PeriodCheck } from '../core/reconcile';
import {
  BONUS_TEXT, UNDO_CLEARED_LABEL, countText, endChoices, endPeriodLabel, feedbackLine, foulLabel, teamFoulsWarn, mayEndGame, oppLabel, playLabel, reconcileBanner, timeoutLabel, timeoutsText,
  undoAriaLabel,
} from './live-logic';

const issue = (period: number, status: PeriodCheck['status']): PeriodCheck => ({
  period, appUs: 0, bookUs: null, diff: null, bookOpp: null, oppTapped: 0, status, note: '',
});

describe('labels', () => {
  it('names each play with the jersey number', () => {
    expect(playLabel('FG2', '4')).toBe('#4 +2');
    expect(playLabel('FG3', '12')).toBe('#12 +3');
    expect(playLabel('FTM', '4')).toBe('#4 FT made');
    expect(playLabel('FTX', '4')).toBe('#4 FT missed');
    expect(playLabel('FOUL', '4')).toBe('#4 Foul');
    expect(playLabel('TECH', '4')).toBe('#4 Tech foul');
  });
  it('names timeouts, opponent taps and period ends', () => {
    expect(timeoutLabel('full')).toBe('Timeout (Full)');
    expect(timeoutLabel('thirty')).toBe('Timeout (30)');
    expect(timeoutLabel('ot')).toBe('Timeout (OT)');
    expect(oppLabel(2)).toBe('Opp +2');
    expect(endPeriodLabel(1)).toBe('End Q1');
    expect(endPeriodLabel(5)).toBe('End OT1');
  });
  it('offers end game from Q4 on only', () => {
    expect([1, 2, 3].some(mayEndGame)).toBe(false);
    expect([4, 5, 6].every(mayEndGame)).toBe(true);
  });
});

describe('timeoutsText', () => {
  const t = {
    full: { used: 1, total: 3 }, thirty: { used: 0, total: 2 }, ot: { used: 1, total: 2 },
  };
  it('omits OT before overtime', () => {
    expect(timeoutsText(t, 4)).toBe('TO left: Full 2 · 30s 2');
  });
  it('shows OT timeouts from the first overtime period', () => {
    expect(timeoutsText(t, 5)).toBe('TO left: Full 2 · 30s 2 · OT 1');
  });
  it('shows OT timeouts in overtime', () => {
    expect(timeoutsText(t, 6)).toBe('TO left: Full 2 · 30s 2 · OT 1');
  });
  it('never goes negative when more timeouts are used than allowed', () => {
    expect(timeoutsText({ ...t, full: { used: 5, total: 3 } }, 1)).toBe('TO left: Full 0 · 30s 2');
  });
});

describe('reconcileBanner', () => {
  it('is null with no open issues', () => {
    expect(reconcileBanner([])).toBeNull();
  });
  it('names the oldest period regardless of list order', () => {
    const b = reconcileBanner([issue(3, 'pending'), issue(1, 'pending'), issue(2, 'unresolved')]);
    expect(b).toEqual({ period: 1, text: 'Q1 not checked against the book — Check' });
  });
  it('words an unresolved mismatch differently and labels overtime', () => {
    expect(reconcileBanner([issue(5, 'unresolved')])?.text).toBe("OT1 doesn't match the book — Check");
  });
});

describe('undoAriaLabel', () => {
  it('explains a disabled Undo only when there are plays it cannot reach', () => {
    expect(undoAriaLabel(false, true)).toBe(UNDO_CLEARED_LABEL);
    expect(UNDO_CLEARED_LABEL).toBe('Undo (history clears when the app reloads — fix plays in Log)');
    expect(undoAriaLabel(true, true)).toBeUndefined();
    expect(undoAriaLabel(false, false)).toBeUndefined();
  });
});

describe('status and toast wording', () => {
  const p = { id: 'p', number: '22', name: 'Player One', pos: '' };
  it('turns team fouls amber from 4, one before the bonus on the 5th', () => {
    expect([3, 4, 5].map(teamFoulsWarn)).toEqual([false, true, true]);
    expect(BONUS_TEXT).toBe('Bonus: they shoot FTs');
  });
  it('names the player on the foul that puts them out', () => {
    expect(foulLabel('FOUL', { player: { p, fouls: 3, techs: 0 }, teamFouls: 1 })).toBe('#22 Foul');
    expect(foulLabel('FOUL', { player: { p, fouls: 4, techs: 0 }, teamFouls: 1 })).toBe('#22 Player One foul — 5th, out');
    expect(foulLabel('FOUL', { player: { p: { ...p, name: '' }, fouls: 4, techs: 0 }, teamFouls: 1 })).toBe('#22 foul — 5th, out');
    expect(foulLabel('TECH', { player: { p, fouls: 2, techs: 1 }, teamFouls: 1 })).toBe('#22 Player One tech foul — 2nd tech, out');
    expect(foulLabel('TECH', { player: { p, fouls: 4, techs: 0 }, teamFouls: 1 })).toBe('#22 Player One tech foul — 5th, out');
    expect(foulLabel('FOUL', { player: { p, fouls: 5, techs: 0 }, teamFouls: 1 })).toBe('#22 Foul');
  });
  it('adds "— bonus" on the 5th team foul only', () => {
    expect(foulLabel('BENCH_TECH', { player: null, teamFouls: 4 })).toBe('Bench tech — bonus');
    expect(foulLabel('BENCH_TECH', { player: null, teamFouls: 5 })).toBe('Bench tech');
    expect(foulLabel('FOUL', { player: { p, fouls: 4, techs: 0 }, teamFouls: 4 })).toBe('#22 Player One foul — 5th, out — bonus');
  });
  it('pluralizes card counts', () => {
    expect([0, 1, 2].map((n) => countText(n, 'point', 'points'))).toEqual(['0 points', '1 point', '2 points']);
  });
  it('words the end-of-period choices', () => {
    expect(endChoices(4)).toMatchObject({ overtime: 'Start overtime', endGame: 'End game (no overtime)' });
    expect(endChoices(5).endGame).toBe('End game (no more overtime)');
    const c = endChoices(4);
    expect(`${c.endGameMain} ${c.endGameNote}`).toBe(c.endGame);
  });
});

describe('feedbackLine', () => {
  const banner = { period: 1, text: 'Q1 not checked against the book — Check' };
  const toast = { text: '#12 +2 — bonus', canUndo: true };
  it('puts the check prompt first', () =>
    expect(feedbackLine(banner, 'Not exported — game data clears in 72 h', toast)).toEqual({ kind: 'prompt', ...banner }));
  it('puts the export warning before the last entry', () =>
    expect(feedbackLine(null, 'Not exported — game data clears in 72 h', toast))
      .toEqual({ kind: 'export', text: 'Not exported — game data clears in 72 h' }));
  it('shows the last entry and whether it can be undone', () => {
    expect(feedbackLine(null, null, toast)).toEqual({ kind: 'entry', text: '#12 +2 — bonus', undoable: true });
    expect(feedbackLine(null, null, { text: 'Undid #12 +2', canUndo: false })).toEqual({ kind: 'entry', text: 'Undid #12 +2', undoable: false });
  });
  it('is empty with nothing to say', () => expect(feedbackLine(null, null, null)).toEqual({ kind: 'empty' }));
});
