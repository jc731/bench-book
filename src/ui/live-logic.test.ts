import { applyLabeled, type GameState } from './game-state';
import { appendEvent, newGame, recordSub } from '../core/events';
import { lineup } from '../core/lineup';
import type { Game } from '../core/types';
import { describe, expect, it } from 'vitest';
import type { PeriodCheck } from '../core/reconcile';
import {
  TAKE_ANYWAY, namedWho, UNDO_CLEARED_LABEL, benchTechLabel, bonusText, timeoutButtonText, timeoutsLeft, who, zeroTimeoutWarning, countText, endChoices, endPeriodLabel, endSlot, feedbackLine, foulLabel, foulOutLabel, playToast, subLabel, teamFoulsWarn, mayEndGame, oppLabel, playLabel, reconcileBanner, timeoutLabel,
  END_GUARD_MS, endTapAllowed, stripPeriodText, subButtonText, undoAriaLabel,
} from './live-logic';
import type { Lineup } from '../core/lineup';
import { outReason } from './live-logic';

const issue = (period: number, status: PeriodCheck['status']): PeriodCheck => ({
  period, spanFrom: period, anchorBook: 0, anchorApp: 0, bookTotal: null, appTotal: 0, bookSpan: null, appSpan: 0,
  diff: null, oppSpanFrom: period, anchorOppBook: 0, bookOppTotal: null, bookOppSpan: null, oppTapped: 0, status, note: '',
});

const pl = (number: string) => ({ id: 'x', number, name: 'N', pos: '' });

describe('labels', () => {
  it('names each play with the jersey number', () => {
    expect(playLabel('FG2', who(pl('4'), 'Home'))).toBe('#4 (Home) +2');
    expect(playLabel('FG3', who(pl('12'), 'Home'))).toBe('#12 (Home) +3');
    expect(playLabel('FTM', who(pl('4'), 'Home'))).toBe('#4 (Home) FT made');
    expect(playLabel('FTX', who(pl('4'), 'Home'))).toBe('#4 (Home) FT missed');
    expect(playLabel('FOUL', who(pl('4'), 'Home'))).toBe('#4 (Home) Foul');
    expect(playLabel('TECH', who(pl('4'), 'Home'))).toBe('#4 (Home) Tech foul');
  });
  it('names timeouts, opponent taps and period ends', () => {
    expect(timeoutLabel('full', 'Home')).toBe('Home timeout (Full)');
    expect(timeoutLabel('thirty', 'Home')).toBe('Home timeout (30s)');
    expect(timeoutLabel('ot', 'Away')).toBe('Away timeout (OT)');
    expect(oppLabel(2)).toBe('Opp +2');
    expect(endPeriodLabel(1)).toBe('End Q1');
    expect(endPeriodLabel(5)).toBe('End OT1');
  });
  it('offers end game from Q4 on only', () => {
    expect([1, 2, 3].some(mayEndGame)).toBe(false);
    expect([4, 5, 6].every(mayEndGame)).toBe(true);
  });
});

describe('a finished game looks finished', () => {
  it('endSlot', () => {
    expect(endSlot(2, false)).toEqual({ text: 'End Q2', opens: 'endPeriod', tone: 'quarter' });
    expect(endSlot(4, false)).toEqual({ text: 'End Q4', opens: 'endSheet', tone: 'game' });
    expect(endSlot(6, false)).toEqual({ text: 'End OT2', opens: 'endSheet', tone: 'game' });
    // The ▸ is a mark beside the name, hidden from screen readers, so the button is named "Final".
    expect(endSlot(5, true)).toEqual({ text: 'Final', mark: '▸', opens: 'final', tone: 'final' });
  });
  it('stripPeriodText', () => {
    expect(stripPeriodText(5, false)).toBe('OT1');
    expect(stripPeriodText(5, true)).toBe('Final');
  });
});

describe('endTapAllowed: a second End tap inside the guard is ignored', () => {
  it('allows the first End, refuses one 150 ms later, allows one after the guard', () => {
    expect(END_GUARD_MS).toBe(1000);
    expect(endTapAllowed(null, 5_000)).toBe(true);
    expect(endTapAllowed(5_000, 5_150)).toBe(false);
    expect(endTapAllowed(5_000, 5_999)).toBe(false);
    expect(endTapAllowed(5_000, 6_000)).toBe(true);
  });
  it('a clock that went backwards does not lock End forever', () => {
    expect(endTapAllowed(5_000, 4_000)).toBe(true);
  });
});

describe('reconcileBanner', () => {
  it('is null with no open issues', () => {
    expect(reconcileBanner([])).toBeNull();
  });
  it('names the oldest period regardless of list order', () => {
    const b = reconcileBanner([issue(3, 'pending'), issue(1, 'pending'), issue(2, 'unresolved')]);
    expect(b).toEqual({ period: 1, text: 'Check Q1 — not checked against the book' });
  });
  it('words an unresolved mismatch differently and labels overtime', () => {
    expect(reconcileBanner([issue(5, 'unresolved')])?.text).toBe("Check OT1 — doesn't match the book");
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
    expect(bonusText('Away')).toBe('Away shoots');
    expect(bonusText('Home')).toBe('Home shoots');
  });
  it('names the player on the foul that puts them out', () => {
    expect(foulLabel('FOUL', { player: { p, fouls: 3, techs: 0 }, teamFouls: 1, tag: 'Home' })).toBe('#22 (Home) Foul');
    expect(foulLabel('FOUL', { player: { p, fouls: 4, techs: 0 }, teamFouls: 1, tag: 'Home' })).toBe('#22 Player One (Home) out, 5 fouls. Tell the official.');
    expect(foulLabel('FOUL', { player: { p: { ...p, name: '' }, fouls: 4, techs: 0 }, teamFouls: 1, tag: 'Home' })).toBe('#22 (Home) out, 5 fouls. Tell the official.');
    expect(foulLabel('TECH', { player: { p, fouls: 2, techs: 1 }, teamFouls: 1, tag: 'Home' })).toBe('#22 Player One (Home) out, 2 techs. Tell the official.');
    expect(foulLabel('TECH', { player: { p, fouls: 4, techs: 0 }, teamFouls: 1, tag: 'Home' })).toBe('#22 Player One (Home) out, 5 fouls. Tell the official.');
    expect(foulLabel('FOUL', { player: { p, fouls: 5, techs: 0 }, teamFouls: 1, tag: 'Home' })).toBe('#22 (Home) Foul');
  });
  it('names the team on the Away side: out and bonus paths', () => {
    expect(foulLabel('FOUL', { player: { p, fouls: 4, techs: 0 }, teamFouls: 1, tag: 'Away' })).toBe('#22 Player One (Away) out, 5 fouls. Tell the official.');
    expect(foulLabel('TECH', { player: { p, fouls: 2, techs: 1 }, teamFouls: 1, tag: 'Away' })).toBe('#22 Player One (Away) out, 2 techs. Tell the official.');
    expect(foulLabel('FOUL', { player: { p, fouls: 4, techs: 0 }, teamFouls: 4, tag: 'Away' })).toBe('#22 Player One (Away) out, 5 fouls — bonus. Tell the official.');
    expect(foulLabel('FOUL', { player: { p, fouls: 1, techs: 0 }, teamFouls: 4, tag: 'Away' })).toBe('#22 (Away) Foul — bonus');
    expect(benchTechLabel('Away')).toBe('Away bench tech');
  });
  it('composes #n name (tag) in one place', () => {
    expect(namedWho(p, 'Away')).toBe('#22 Player One (Away)');
    expect(namedWho({ ...p, name: '' }, 'Home')).toBe('#22 (Home)');
    expect(namedWho(null, 'Away')).toBe('Away');
  });
  it('adds "— bonus" on the 5th team foul only', () => {
    expect(foulLabel('BENCH_TECH', { player: null, teamFouls: 4, tag: 'Home' })).toBe('Home bench tech — bonus');
    expect(foulLabel('BENCH_TECH', { player: null, teamFouls: 5, tag: 'Away' })).toBe('Away bench tech');
    expect(foulLabel('FOUL', { player: null, teamFouls: 4, tag: 'Away' })).toBe('Away Foul — bonus');
  });
  it('words a foul with no number as the team play, like playLabel', () => {
    expect(foulLabel('FOUL', { player: null, teamFouls: 1, tag: 'Away' })).toBe('Away Foul');
    expect(foulLabel('TECH', { player: null, teamFouls: 2, tag: 'Home' })).toBe('Home Tech foul');
    expect(foulLabel('TECH', { player: null, teamFouls: 4, tag: 'Home' })).toBe('Home Tech foul — bonus');
    expect(foulLabel('FOUL', { player: { p, fouls: 4, techs: 0 }, teamFouls: 4, tag: 'Home' })).toBe('#22 Player One (Home) out, 5 fouls — bonus. Tell the official.');
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

describe('feedbackLine prompts', () => {
  it('start their accessible text with the chip text (WCAG label in name)', () => {
    const b = reconcileBanner([{ period: 1, status: 'pending' } as never]);
    const open = feedbackLine(b, null, null).prompt!;
    expect(open.text.startsWith(open.chip)).toBe(true);
    const ex = feedbackLine(null, 'Not exported — game data clears in 72 h', null).prompt!;
    expect(ex.text.startsWith(ex.chip)).toBe(true);
  });
});

describe('feedbackLine', () => {
  const banner = { period: 1, text: 'Check Q1 — not checked against the book' };
  const unexported = 'Not exported — game data clears in 72 h';
  const toast = { text: '#12 +2 — bonus', canUndo: true };
  const check = { kind: 'check', period: 1, text: banner.text, chip: 'Check Q1' };
  it('shows the last entry beside the check prompt, which outranks the export warning', () =>
    expect(feedbackLine(banner, unexported, toast)).toEqual({ entry: { text: '#12 +2 — bonus', undoable: true, redoable: false }, prompt: check }));
  it('shows the export warning as the chip when no check is open', () =>
    expect(feedbackLine(null, unexported, { text: 'Exported Book CSV', canUndo: false })).toEqual({
      entry: { text: 'Exported Book CSV', undoable: false, redoable: false },
      prompt: { kind: 'export', text: unexported, chip: 'Not exported' },
    }));
  it('shows the entry alone, and whether it can be undone', () => {
    expect(feedbackLine(null, null, toast)).toEqual({ entry: { text: '#12 +2 — bonus', undoable: true, redoable: false }, prompt: null });
    expect(feedbackLine(null, null, { text: 'Undid #12 +2', canUndo: false, canRedo: true })).toEqual({
      entry: { text: 'Undid #12 +2', undoable: false, redoable: true }, prompt: null,
    });
  });
  it('shows the prompt alone with no entry', () =>
    expect(feedbackLine(banner, null, null)).toEqual({ entry: null, prompt: check }));
  it('is empty with nothing to say', () => expect(feedbackLine(null, null, null)).toEqual({ entry: null, prompt: null }));
});

describe('outReason', () => {
  it('is null while the player can play, including at 4 fouls and 1 tech', () => {
    expect(outReason(undefined)).toBeNull();
    expect(outReason({ fouls: 4, techs: 1 })).toBeNull();
  });
  it('names 5 fouls, or 2 techs when the fouls are under 5', () => {
    expect(outReason({ fouls: 5, techs: 0 })).toBe('5 fouls');
    expect(outReason({ fouls: 2, techs: 2 })).toBe('2 techs');
    expect(outReason({ fouls: 6, techs: 2 })).toBe('6 fouls');
  });
});

describe('two-team copy', () => {
  it('who names the team, with or without a player', () => {
    expect(who(pl('4'), 'Home')).toBe('#4 (Home)');
    expect(who(pl('14'), 'Away')).toBe('#14 (Away)');
    expect(who(null, 'Away')).toBe('Away');
  });
  it('names a bench tech by team', () => {
    expect(benchTechLabel('Home')).toBe('Home bench tech');
  });
  it('timeout buttons show what is left, never below 0', () => {
    expect(timeoutButtonText('full', 2)).toBe('Full: 2');
    expect(timeoutButtonText('thirty', 0)).toBe('30s: 0');
    expect(timeoutButtonText('ot', 1)).toBe('OT: 1');
    expect(timeoutButtonText('full', -1)).toBe('Full: 0');
  });
  it('timeoutsLeft is total minus used', () => {
    const t = { full: { used: 1, total: 3 as const }, thirty: { used: 2, total: 2 as const }, ot: { used: 0, total: 1 } };
    expect(timeoutsLeft(t, 'full')).toBe(2);
    expect(timeoutsLeft(t, 'thirty')).toBe(0);
    expect(timeoutsLeft(t, 'ot')).toBe(1);
  });
  it('warns when a team has none of a kind left', () => {
    expect(zeroTimeoutWarning('Away', 'full')).toBe('Away has no full timeouts left. Are you sure?');
    expect(zeroTimeoutWarning('Home', 'thirty')).toBe('Home has no 30-second timeouts left. Are you sure?');
    expect(zeroTimeoutWarning('Home', 'ot')).toBe('Home has no OT timeouts left. Are you sure?');
    expect(TAKE_ANYWAY).toBe('Take one anyway');
  });
});

describe('lineup toasts', () => {
  const info = { team: 'Maple Hill', opponent: 'Cedar Run', date: '2026-11-17', homeAway: 'home' as const, coach: 'C', scorer: 'S', timer: 'T' };
  const roster = ['4', '5', '7', '10', '12', '22'].map((n) => ({ id: `h${n}`, number: n, name: `Player ${n}`, pos: '' }));
  const t0 = new Date('2026-11-17T10:00:00Z');
  const base = newGame(info, roster, t0);
  it('words the foul-out toast, bonus before the instruction', () => {
    expect(foulOutLabel('#12 Ada (Home)', '5 fouls')).toBe('#12 Ada (Home) out, 5 fouls. Tell the official.');
    expect(foulOutLabel('#12 Ada (Home)', '2 techs', true)).toBe('#12 Ada (Home) out, 2 techs — bonus. Tell the official.');
  });
  it('a bench player\'s 5th foul is the foul-out sentence', () => {
    let g = base;
    for (let i = 0; i < 4; i++) g = appendEvent(g, { period: 1, type: 'FOUL', playerId: 'h22' }, t0);
    g = recordSub(g, 'us', ['h4'], ['h22'], t0); // back to the bench with 4 fouls
    expect(lineup(g, 'us').floor).not.toContain('h22');
    const h = appendEvent(g, { period: 1, type: 'FOUL', playerId: 'h22' }, t0);
    expect(lineup(h, 'us').floor).not.toContain('h22'); // lineup does not promote a player the play puts out
    const p = roster[5];
    expect(playToast(g, 'us', p, 'FOUL')).toBe('#22 Player 22 (Home) out, 5 fouls — bonus. Tell the official.');
  });
  it('words a play from the game it is applied to: two taps with no render between each get the plain toast (D4: no floor suffix)', () => {
    const play = (g: Game) => {
      const next = appendEvent(g, { period: 1, type: 'FG2', playerId: 'h22' }, t0);
      return { game: next, label: playToast(g, 'us', roster[5], 'FG2') };
    };
    let s: GameState = { game: base, stack: [] };
    const first = applyLabeled(s, play, '', t0);
    s = first.state;
    const second = applyLabeled(s, play, '', t0);
    expect(first.label).toBe('#22 (Home) +2');
    expect(second.label).toBe('#22 (Home) +2');
    expect(second.state.stack.at(-1)?.label).toBe('#22 (Home) +2');
  });
  it('words a sub', () => {
    expect(subLabel(base, 'us', ['h22'], ['h10'])).toBe('#22 (Home) in for #10');
    expect(subLabel(base, 'us', ['h22', 'h7'], ['h10'])).toBe('Home floor updated');
    expect(subLabel(base, 'us', [], ['h10'])).toBe('Home floor updated');
  });
});

describe('the Sub button', () => {
  const base: Lineup = {
    floor: ['a', 'b', 'c', 'd', 'e'], bench: ['f'], layout: ['a', 'b', 'c', 'd', 'e', 'f'], layoutFloor: 5, outIds: [], justIn: null,
    suggestion: 'a', tracked: true, playedYet: true, changedUnseen: false,
  };
  const six = ['a', 'b', 'c', 'd', 'e', 'f'];
  it('is absent when the roster has five or fewer', () => {
    expect(subButtonText({ ...base, tracked: false, bench: [] })).toBeNull();
    expect(subButtonText({ ...base, tracked: false, floor: ['a', 'b', 'c', 'd'], changedUnseen: true })).toBeNull();
  });
  it('reads Starters before the team has played, else Sub whatever the floor count (D3)', () => {
    expect(subButtonText({ ...base, playedYet: false })).toBe('Starters');
    expect(subButtonText(base)).toBe('Sub');
    expect(subButtonText({ ...base, floor: six, changedUnseen: true })).toBe('Sub');
    expect(subButtonText({ ...base, floor: ['a', 'b', 'c', 'd'], changedUnseen: true })).toBe('Sub');
  });
});
