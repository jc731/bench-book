import { describe, expect, it } from 'vitest';
import { appendEvent, moveFrom, newGame } from '../core/events';
import { lineup } from '../core/lineup';
import type { EventDraft, Game, GameEvent } from '../core/types';
import { applyUndo, applyUpdate } from './game-state';
import {
  addedLabel, alsoMoveText, canSave, eventLabel, compatibleTypes, draftOf, editLabel, editPatch, editSave, editTitle, eventRowText,
  followersCount, groupByPeriod, moveFromCount, moveFromLabel, playsCount, resumeText,
} from './log-logic';

const info = { team: 'T', opponent: 'O', date: '2026-11-10', homeAway: 'home' as const, coach: '', scorer: '', timer: '' };
const roster = [
  { id: 'a', number: '4', name: 'Player One', pos: '' },
  { id: 'b', number: '7', name: '', pos: '' },
];
const NOW = new Date('2026-11-10T12:00:00Z');

function game(drafts: EventDraft[], currentPeriod = 3): Game {
  let g = { ...newGame(info, roster, NOW), currentPeriod };
  for (const d of drafts) g = appendEvent(g, d, NOW);
  return g;
}
const first = (g: Game): GameEvent => g.events[0];

describe('eventRowText', () => {
  const g = game([
    { type: 'FG2', playerId: 'a' },
    { type: 'FOUL', playerId: 'b' },
    { type: 'OPP_PTS', oppPoints: 3 },
    { type: 'TIMEOUT', timeoutKind: 'full' },
    { type: 'BENCH_TECH' },
    { type: 'FTX', playerId: 'zz' },
  ]);
  it('reads number, name, then the play', () => {
    expect(eventRowText(g, g.events[0])).toBe('#4 Player One (Home) · +2');
  });
  it('drops the name when blank and tolerates an unknown player', () => {
    expect(eventRowText(g, g.events[1])).toBe('#7 (Home) · Foul');
    expect(eventRowText(g, g.events[5])).toBe('#? (Home) · FT missed');
  });
  it('writes non-player events without a player', () => {
    expect(eventRowText(g, g.events[2])).toBe('Opp +3');
    expect(eventRowText(g, g.events[3])).toBe('Home timeout (Full)');
    expect(eventRowText(g, g.events[4])).toBe('Home bench tech');
  });
});

describe('their-side rows and labels', () => {
  const opp = [{ id: 'x', number: '14', name: '', pos: '' }, { id: 'y', number: '3', name: 'Guest Three', pos: '' }];
  const gg = { ...newGame(info, roster, NOW, opp), currentPeriod: 3 };
  const g = [
    { type: 'FG2', playerId: 'x', side: 'them' },
    { type: 'FG2', side: 'them' },
    { type: 'BENCH_TECH', side: 'them' },
    { type: 'TIMEOUT', timeoutKind: 'thirty', side: 'them' },
    { type: 'FG3', playerId: 'y', side: 'them' },
    { type: 'FG2' },
  ].reduce((acc, d) => appendEvent(acc, d as EventDraft, NOW), gg);
  it('names the team on every row', () => {
    expect(eventRowText(g, g.events[0])).toBe('#14 (Away) · +2');
    expect(eventRowText(g, g.events[4])).toBe('#3 Guest Three (Away) · +3');
    expect(eventRowText(g, g.events[1])).toBe('Away · +2');
    expect(eventRowText(g, g.events[2])).toBe('Away bench tech');
    expect(eventRowText(g, g.events[3])).toBe('Away timeout (30s)');
    expect(eventRowText(g, g.events[5])).toBe('Home · +2');
  });
  it('labels toasts the same way', () => {
    expect(eventLabel(g, g.events[0])).toBe('#14 (Away) +2');
    expect(eventLabel(g, g.events[1])).toBe('Away +2');
    expect(eventLabel(g, g.events[2])).toBe('Away bench tech');
    expect(eventLabel(g, g.events[3])).toBe('Away timeout (30s)');
  });
  it('moves a play to the other team, clearing a stale player', () => {
    const e = g.events[0];
    expect(editPatch(e, { ...draftOf(e), side: undefined, playerId: 'a' })).toStrictEqual({ side: undefined, playerId: 'a' });
    expect('side' in editPatch(e, { ...draftOf(e), side: undefined, playerId: 'a' })).toBe(true);
    const stale = editPatch(e, { ...draftOf(e), side: undefined });
    expect('playerId' in stale && stale.playerId === undefined).toBe(true);
    expect(editPatch(g.events[5], { ...draftOf(g.events[5]), side: 'them', playerId: undefined })).toEqual({ side: 'them' });
    expect(editPatch(g.events[2], { ...draftOf(g.events[2]), side: undefined })).toStrictEqual({ side: undefined });
  });
  it('labels a team move and needs a player pick after one', () => {
    const e = g.events[0];
    expect(editLabel(g, e, { side: undefined, playerId: 'a' })).toBe('Edited #14 (Away) +2 → #4 (Home) +2');
    expect(canSave(draftOf(e))).toBe(true);
    expect(canSave({ ...draftOf(e), unpicked: true })).toBe(false);
  });
});

describe('groupByPeriod', () => {
  const g = game([
    { type: 'FG2', playerId: 'a', period: 1 },
    { type: 'FG3', playerId: 'a', period: 2 },
    { type: 'FOUL', playerId: 'b', period: 1 },
  ]);
  it('lists the newest period first and the newest play first by default', () => {
    const groups = groupByPeriod(g);
    expect(groups.map((x) => x.period)).toEqual([2, 1]);
    expect(groups[1].events.map((e) => e.type)).toEqual(['FOUL', 'FG2']);
  });
  it('lists both oldest first when asked (the quarter check)', () => {
    expect(groupByPeriod(g, undefined, 'oldest').map((x) => x.period)).toEqual([1, 2]);
    expect(groupByPeriod(g, 1, 'oldest')[0].events.map((e) => e.type)).toEqual(['FG2', 'FOUL']);
  });
  it('sorts by order, not array position', () => {
    const swapped = { ...g, events: [...g.events].reverse() };
    expect(groupByPeriod(swapped)[1].events.map((e) => e.type)).toEqual(['FOUL', 'FG2']);
    expect(groupByPeriod(swapped, 1, 'oldest')[0].events.map((e) => e.type)).toEqual(['FG2', 'FOUL']);
  });
  it('filters to one period and gives nothing for an empty one', () => {
    expect(groupByPeriod(g, 1)).toHaveLength(1);
    expect(groupByPeriod(g, 1)[0].events).toHaveLength(2);
    expect(groupByPeriod(g, 3)).toEqual([]);
  });
});

describe('editing', () => {
  const g = game([
    { type: 'FG2', playerId: 'a' },
    { type: 'TIMEOUT', timeoutKind: 'full' },
    { type: 'OPP_PTS', oppPoints: 2 },
    { type: 'BENCH_TECH' },
  ]);
  it('offers only compatible types', () => {
    expect(compatibleTypes(g.events[0])).toEqual(['FG2', 'FG3', 'FTM', 'FTX', 'FOUL', 'TECH']);
    expect(compatibleTypes(g.events[1])).toEqual(['TIMEOUT']);
    expect(compatibleTypes(g.events[2])).toEqual(['OPP_PTS']);
    expect(compatibleTypes(g.events[3])).toEqual(['BENCH_TECH']);
  });
  it('patches only what changed', () => {
    const e = first(g);
    expect(editPatch(e, { ...draftOf(e), type: 'FG3' })).toEqual({ type: 'FG3' });
    expect(editPatch(e, { ...draftOf(e), playerId: 'b', period: 2 })).toEqual({ playerId: 'b', period: 2 });
    expect(editPatch(e, draftOf(e))).toEqual({});
  });
  it('clears fields the final type does not use', () => {
    const stale: GameEvent = { ...first(g), oppPoints: 2, timeoutKind: 'full' };
    const p = editPatch(stale, draftOf(stale));
    expect('oppPoints' in p && p.oppPoints === undefined).toBe(true);
    expect('timeoutKind' in p && p.timeoutKind === undefined).toBe(true);
    const bench: GameEvent = { ...g.events[3], playerId: 'a' };
    const bp = editPatch(bench, draftOf({ ...bench, playerId: undefined }));
    expect('playerId' in bp && bp.playerId === undefined).toBe(true);
    const t = g.events[1];
    expect(editPatch(t, { ...draftOf(t), timeoutKind: 'thirty' })).toEqual({ timeoutKind: 'thirty' });
    const o = g.events[2];
    expect(editPatch(o, { ...draftOf(o), oppPoints: 3 })).toEqual({ oppPoints: 3 });
  });
  it('labels edits for the toast', () => {
    const e = first(g);
    expect(editLabel(g, e, { type: 'FG3' })).toBe('Edited #4 (Home) +2 → +3');
    expect(editLabel(g, e, { playerId: 'b' })).toBe('Edited #4 (Home) +2 → #7 (Home) +2');
    expect(editLabel(g, e, { period: 2 })).toBe('Moved #4 (Home) +2 to Q2');
    expect(editLabel(g, e, { type: 'FOUL', period: 2 })).toBe('Edited #4 (Home) +2 → Foul, now in Q2');
    expect(editLabel(g, g.events[2], { oppPoints: 3 })).toBe('Edited Opp +2 → Opp +3');
  });
  it('labels an added play with the period', () => {
    expect(addedLabel('FG2', '#4 (Home)', 2)).toBe('Added #4 (Home) +2 to Q2');
  });
  it('titles the fix sheet with the play and its quarter', () => {
    const q1 = game([{ type: 'FG2', playerId: 'a' }, { type: 'TIMEOUT', timeoutKind: 'full' }], 1);
    expect(editTitle(q1, q1.events[0])).toBe('Fix: #4 (Home) +2 · Q1');
    expect(editTitle(q1, q1.events[1])).toBe('Fix: Home timeout (Full) · Q1');
    expect(editTitle(g, first(g))).toBe('Fix: #4 (Home) +2 · Q3');
  });
});

describe('moving', () => {
  const g = game(
    [
      { type: 'FG2', playerId: 'a', period: 1 },
      { type: 'FG2', playerId: 'a', period: 1 },
      { type: 'FG2', playerId: 'a', period: 1 },
      { type: 'FG2', playerId: 'a', period: 2 },
      { type: 'FG2', playerId: 'a', period: 1 }, // later by order, but an earlier period
    ],
    3,
  );
  // A legacy shape appendEvent no longer makes: hand-set orders keep the late Q1 play after Q2.
  g.events = g.events.map((e, i) => ({ ...e, order: i }));
  it('counts what moveFrom touches', () => {
    expect(moveFromCount(g, g.events[1].id)).toBe(3); // itself, the next Q1 play, and the late Q1 play; the Q2 play stays
    expect(moveFromCount(g, g.events[3].id)).toBe(1); // the later Q1 play is an earlier period, so it stays
    expect(moveFromCount(g, 'nope')).toBe(0);
  });
  it('matches the number of plays whose period actually changes', () => {
    for (const e of g.events) {
      const target = e.period === 1 ? 2 : 1;
      const moved = moveFrom(g, e.id, target, NOW);
      const changed = moved.events.filter((m, i) => m.period !== g.events[i].period).length;
      expect(moveFromCount(g, e.id)).toBe(changed);
    }
  });
  it('words the count', () => {
    expect(playsCount(1)).toBe('1 play');
    expect(playsCount(3)).toBe('3 plays');
    expect(moveFromLabel(5, 2)).toBe('Moved 5 plays to Q2');
    expect(moveFromLabel(1, 6)).toBe('Moved 1 play to OT2');
    expect(alsoMoveText(1, 3)).toBe('Also move the 1 play after it in Q3');
    expect(alsoMoveText(3, 3)).toBe('Also move the 3 plays after it in Q3');
  });
  it('counts the plays after it in its quarter', () => {
    expect(followersCount(g, g.events[1].id)).toBe(2);
    expect(followersCount(g, g.events[3].id)).toBe(0);
    expect(followersCount(g, 'nope')).toBe(0);
  });
});

describe('editSave', () => {
  // Q3: #4 +2 (the one fixed), #7 Foul, Opp +2; then a Q4 play. Q1 and Q2 hold one play each.
  const g = game(
    [
      { type: 'FG2', playerId: 'b', period: 1 },
      { type: 'FG3', playerId: 'b', period: 2 },
      { type: 'FG2', playerId: 'a', period: 3 },
      { type: 'FOUL', playerId: 'b', period: 3 },
      { type: 'OPP_PTS', oppPoints: 2, period: 3 },
      { type: 'FTM', playerId: 'b', period: 4 },
    ],
    4,
  );
  const e = g.events[2];
  const periods = (x: Game) => x.events.map((y) => y.period);
  const apply = (s: NonNullable<ReturnType<typeof editSave>>) => s.apply(g, NOW);

  it('is null when nothing changes, ticked or not', () => {
    expect(editSave(g, e, draftOf(e), false)).toBeNull();
    expect(editSave(g, e, draftOf(e), true)).toBeNull();
  });
  it('moves the play and the ones after it, unmarked, when only the quarter changed', () => {
    const s = editSave(g, e, { ...draftOf(e), period: 4 }, true)!;
    expect(s.label).toBe('Moved 3 plays to Q4');
    const next = apply(s);
    expect(periods(next)).toEqual([1, 2, 4, 4, 4, 4]);
    expect(next.events.filter((x) => x.editedAt)).toEqual([]);
  });
  it('changes the player and moves the plays after it in one step', () => {
    const d = { ...draftOf(e), playerId: 'b', period: 4 };
    const s = editSave(g, e, d, true)!;
    const prefix = editLabel(g, e, { playerId: 'b' });
    expect(prefix).toBe('Edited #4 (Home) +2 → #7 (Home) +2');
    expect(s.label).toBe(`${prefix}; moved 3 plays to Q4`);
    const next = apply(s);
    const fixed = next.events.find((x) => x.id === e.id)!;
    expect(fixed.playerId).toBe('b');
    expect(fixed.editedAt).toBe(NOW.toISOString());
    expect(periods(next)).toEqual([1, 2, 4, 4, 4, 4]);
    // The fixed play and its followers stay in their order, ahead of the play already in Q4.
    expect(next.events.filter((x) => x.period === 4).sort((a, b) => a.order - b.order).map((x) => x.id)).toEqual(
      [2, 3, 4, 5].map((i) => g.events[i].id),
    );
  });
  it('undoes back to the game as it was', () => {
    const s = editSave(g, e, { ...draftOf(e), playerId: 'b', period: 4 }, true)!;
    const after = applyUpdate({ game: g, stack: [] }, s.apply, s.label, NOW);
    const back = applyUndo(after);
    expect(back.state.game).toEqual(g);
    expect(back.state.stack).toEqual([]);
  });
  it('moves only the play when not ticked', () => {
    const s = editSave(g, e, { ...draftOf(e), period: 4 }, false)!;
    expect(s.label).toBe('Moved #4 (Home) +2 to Q4');
    expect(periods(apply(s))).toEqual([1, 2, 4, 3, 3, 4]);
  });
  it('moves backward too, to a quarter that is not next to it', () => {
    const s = editSave(g, e, { ...draftOf(e), period: 1 }, true)!;
    expect(s.label).toBe('Moved 3 plays to Q1');
    const next = apply(s);
    expect(periods(next)).toEqual([1, 2, 1, 1, 1, 4]);
    const ordered = [...next.events].sort((a, b) => a.order - b.order).map((x) => x.period);
    expect(ordered).toEqual([1, 1, 1, 1, 2, 4]);
  });
  it('is a plain edit when ticked but nothing follows it', () => {
    const last = g.events[4];
    const s = editSave(g, last, { ...draftOf(last), period: 4 }, true)!;
    expect(s.label).toBe('Moved Opp +2 to Q4');
    expect(periods(apply(s))).toEqual([1, 2, 3, 3, 4, 4]);
  });
  it('ignores the tick when the quarter did not change', () => {
    const s = editSave(g, e, { ...draftOf(e), type: 'FG3' }, true)!;
    expect(s.label).toBe('Edited #4 (Home) +2 → +3');
    expect(periods(apply(s))).toEqual([1, 2, 3, 3, 3, 4]);
  });
});

describe('editSave: a changed player on an earlier quarter\'s play is late (D11; final review #1)', () => {
  // Ten players, so h1..h5 start on the floor and h6..h10 on the bench (lineup: roster order).
  const ten = Array.from({ length: 10 }, (_, i) => ({ id: `h${i + 1}`, number: String(i + 1), name: `Pat ${i + 1}`, pos: '' }));
  const withPlay = (period: number, currentPeriod: number): Game => {
    const g = { ...newGame(info, ten, NOW), currentPeriod };
    return appendEvent(g, { type: 'FG2', playerId: 'h1', period }, NOW);
  };
  const STARTERS = ['h1', 'h2', 'h3', 'h4', 'h5'];
  const fixTo = (g: Game, d: Partial<ReturnType<typeof draftOf>>, alsoMove = false) => {
    const e = first(g);
    return editSave(g, e, { ...draftOf(e), ...d }, alsoMove)!.apply(g, NOW);
  };

  it('the review probe: a Q1 +2 by h1, game in Q3, re-credited to bench h7, leaves the floor h1..h5', () => {
    const next = fixTo(withPlay(1, 3), { playerId: 'h7' });
    expect(first(next).playerId).toBe('h7');
    expect(first(next).late).toBe(true);
    expect(lineup(next, 'us').floor).toEqual(STARTERS);
  });
  it('the same fix within the current quarter still promotes (D10: as a live tap)', () => {
    const next = fixTo(withPlay(3, 3), { playerId: 'h7' });
    expect(first(next).late).toBeUndefined();
    expect(lineup(next, 'us').floor).toContain('h7');
  });
  it('an ended game counts as over for every quarter (D13)', () => {
    const g = { ...withPlay(3, 3), endedAt: NOW.toISOString() };
    const next = fixTo(g, { playerId: 'h7' });
    expect(first(next).late).toBe(true);
    expect(lineup(next, 'us').floor).toEqual(STARTERS);
  });
  it('a change of player with "Also move" to an earlier quarter is late too (the quarter it ends in decides)', () => {
    const g = appendEvent(withPlay(3, 3), { type: 'FOUL', playerId: 'h2', period: 3 }, NOW);
    const next = fixTo(g, { playerId: 'h7', period: 1 }, true);
    expect(first(next).late).toBe(true);
    expect(lineup(next, 'us').floor).toEqual(STARTERS);
  });
  it('moving an earlier play to the other team is late too (the player changes)', () => {
    const next = fixTo(withPlay(1, 3), { side: 'them', playerId: undefined });
    expect(first(next).side).toBe('them');
    expect(first(next).late).toBe(true);
  });
  it('a pure move back a quarter is left alone: the player really did play (final review #1)', () => {
    const next = fixTo(withPlay(3, 3), { period: 1 });
    expect(first(next).late).toBeUndefined();
  });
  it('a type change on an earlier play is not marked late (the player is unchanged)', () => {
    const next = fixTo(withPlay(1, 3), { type: 'FG3' });
    expect(first(next).late).toBeUndefined();
  });
});

describe('resumeText', () => {
  it('is null with no plays', () => {
    expect(resumeText(game([]))).toBeNull();
  });
  it('is null for an ended game', () => {
    const g = game([{ type: 'FG2', playerId: 'a' }]);
    expect(resumeText(g)).not.toBeNull();
    expect(resumeText({ ...g, endedAt: NOW.toISOString() })).toBeNull();
  });
  it('names the most recently entered play, by number', () => {
    let g = game([{ type: 'FG2', playerId: 'b' }]);
    g = appendEvent(g, { type: 'FG2', playerId: 'a' }, new Date(NOW.getTime() + 1000));
    expect(resumeText(g)).toBe('Last: #4 (Home) +2');
    // A play that sorts first but was entered last is still "last".
    const early = { ...g, events: g.events.map((e, i) => (i === 1 ? { ...e, order: -1 } : e)) };
    expect(resumeText(early)).toBe('Last: #4 (Home) +2');
  });
  it('words non-player events like the feedback line', () => {
    expect(resumeText(game([{ type: 'OPP_PTS', oppPoints: 3 }]))).toBe('Last: Opp +3');
  });
});
