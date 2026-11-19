import { describe, expect, test } from 'vitest';
import { derive, type TeamDerived } from './derive';
import { applyTeams, lockedPlayerIds, teamsDraftOf, type TeamsDraft } from './edit-teams';
import { appendEvent, newGame, recordSub } from './events';
import { bookCsv } from './export-book';
import { playsCsv } from './export-plays';
import { lineup } from './lineup';
import type { Game, GameInfo, Player, Side } from './types';
import { cleanOppRoster, setupRosterErrors } from '../ui/roster';

// Invented names only (the repo is public).
const info: GameInfo = {
  team: 'Maple Hill', opponent: 'Cedar Run', date: '2026-11-19', homeAway: 'home',
  coach: '', scorer: '', timer: '',
};
const now = new Date('2026-11-19T18:00:00Z');
const later = new Date('2026-11-19T18:30:00Z');

const ours: Player[] = ['4', '5', '7', '10', '12', '22', '31'].map((n, i) => ({
  id: `h${n}`, number: n, name: ['Ada Quill', 'Bea Fenn', 'Cora Lusk', 'Dot Merrow', 'Eve Strand', 'Fay Tolliver', 'Gia Wren'][i], pos: '',
}));
// Their roster as Whose number? builds it: numbers with empty names (Review Focus 2).
const theirs: Player[] = ['2', '3', '11', '14', '20', '24'].map((n) => ({ id: `t${n}`, number: n, name: '', pos: '' }));

/** A game with plays for both teams, a sub on each side and an export mark. */
function played(): Game {
  let g = newGame(info, ours, now, theirs);
  g = appendEvent(g, { type: 'FG2', playerId: 'h4' }, now);
  g = appendEvent(g, { type: 'FOUL', playerId: 'h5' }, now);
  g = appendEvent(g, { type: 'FG3', playerId: 't2', side: 'them' }, now);
  g = appendEvent(g, { type: 'TIMEOUT', timeoutKind: 'full' }, now);
  g = recordSub(g, 'us', ['h22'], ['h10'], now); // #22 in for #10: #22 has no play, only a sub
  g = appendEvent(g, { type: 'FTM', playerId: 'h22' }, now);
  g = recordSub(g, 'them', ['t24'], ['t20'], now); // #24 is in a sub and has no play
  g = appendEvent(g, { type: 'FOUL', playerId: 't3', side: 'them' }, now);
  return { ...g, exported: { book: now.toISOString(), plays: now.toISOString() } };
}

/** Renumbers and renames one of ours and one of theirs, and adds a player to each side. */
function edited(g: Game): TeamsDraft {
  const d = teamsDraftOf(g);
  return {
    ...d,
    roster: [
      ...d.roster.map((p) => (p.id === 'h4' ? { ...p, number: '40', name: 'Ada Quill-Ross' } : p)),
      { id: 'hnew', number: '33', name: 'Hal Imber', pos: '' },
    ],
    oppRoster: [
      ...d.oppRoster.map((p) => (p.id === 't2' ? { ...p, number: '21', name: 'Ivy Ostrom' } : p)),
      { id: 'tnew', number: '33', name: '', pos: '' },
    ],
  };
}

/** The numbers a team's line carries, without the function-valued field. */
function numbers(t: TeamDerived) {
  const { teamFoulsForBonus: _f, ...rest } = t;
  return rest;
}

describe('teamsDraftOf', () => {
  test('copies the names and both rosters from the game (D10: Edit teams opens on the game as it is)', () => {
    const g = played();
    expect(teamsDraftOf(g)).toEqual({ team: 'Maple Hill', opponent: 'Cedar Run', roster: ours, oppRoster: theirs });
  });
});

describe('applyTeams', () => {
  test('I1: events and subs are deep-equal after renumbering, renaming and adding', () => {
    const g = played();
    const after = applyTeams(g, edited(g), later);
    expect(after.events).toEqual(g.events);
    expect(after.subs).toEqual(g.subs);
  });

  test('I2: every score, team foul, timeout count and player line is unchanged', () => {
    const g = played();
    const before = derive(g);
    const after = derive(applyTeams(g, edited(g), later));
    for (const side of ['us', 'opp'] as const) {
      const b = numbers(before[side]);
      const a = numbers(after[side]);
      expect(a.total).toBe(b.total);
      expect(a.byPeriod).toEqual(b.byPeriod);
      expect(a.teamFoulsByPeriod).toEqual(b.teamFoulsByPeriod);
      expect(a.benchTechs).toBe(b.benchTechs);
      expect(a.timeouts).toEqual(b.timeouts);
      expect(a.noNumber).toEqual(b.noNumber);
      // An added player gets a zero line; every existing player's line is the same.
      expect(a.players.slice(0, b.players.length)).toEqual(b.players);
      expect(a.players.slice(b.players.length).every((l) => l.points === 0 && l.fouls === 0)).toBe(true);
    }
    expect(after.usTotal).toBe(before.usTotal);
    expect(after.oppTotal).toBe(before.oppTotal);
  });

  test("I3: every play's playerId is still on its side's roster", () => {
    const g = played();
    const after = applyTeams(g, edited(g), later);
    for (const e of after.events) {
      if (!e.playerId) continue;
      const roster = e.side === 'them' ? after.oppRoster : after.roster;
      expect(roster.map((p) => p.id)).toContain(e.playerId);
    }
  });

  test('I4: the floor is unchanged after renumbering, renaming and adding a player to each side', () => {
    const g = played();
    const after = applyTeams(g, edited(g), later);
    for (const side of ['us', 'them'] as Side[]) expect(lineup(after, side).floor).toEqual(lineup(g, side).floor);
  });

  test('I4: before any sub, adding a player to a roster of more than five leaves the starting five', () => {
    const g = newGame(info, ours, now, theirs);
    const after = applyTeams(g, edited(g), later);
    for (const side of ['us', 'them'] as Side[]) expect(lineup(after, side).floor).toEqual(lineup(g, side).floor);
  });

  test('D13: an added player is last and the existing order is unchanged', () => {
    const g = played();
    const after = applyTeams(g, edited(g), later);
    expect(after.roster.map((p) => p.id)).toEqual([...ours.map((p) => p.id), 'hnew']);
    expect(after.oppRoster.map((p) => p.id)).toEqual([...theirs.map((p) => p.id), 'tnew']);
  });

  test('D12/D13: existing players keep their old order and id even if the draft lists them out of order', () => {
    const g = played();
    const d = teamsDraftOf(g);
    const after = applyTeams(g, { ...d, roster: [...d.roster].reverse() }, later);
    expect(after.roster.map((p) => p.id)).toEqual(ours.map((p) => p.id));
  });

  test('D12: a renumbered and renamed player keeps their id, with the new number and name', () => {
    const g = played();
    const after = applyTeams(g, edited(g), later);
    expect(after.roster[0]).toEqual({ id: 'h4', number: '40', name: 'Ada Quill-Ross', pos: '' });
    expect(after.oppRoster[0]).toEqual({ id: 't2', number: '21', name: 'Ivy Ostrom', pos: '' });
  });

  test('D14: an unlocked player can be removed', () => {
    const g = played();
    const d = teamsDraftOf(g);
    const after = applyTeams(g, { ...d, roster: d.roster.filter((p) => p.id !== 'h31') }, later);
    expect(after.roster.map((p) => p.id)).not.toContain('h31');
  });

  test('D14: removing a locked player throws', () => {
    const g = played();
    const d = teamsDraftOf(g);
    expect(() => applyTeams(g, { ...d, roster: d.roster.filter((p) => p.id !== 'h4') }, later)).toThrow();
    expect(() => applyTeams(g, { ...d, oppRoster: d.oppRoster.filter((p) => p.id !== 't24') }, later)).toThrow();
  });

  test('D11: a blank opponent becomes the MM-DD default; a typed one is trimmed', () => {
    const g = played();
    expect(applyTeams(g, { ...teamsDraftOf(g), opponent: '   ' }, later).info.opponent).toBe('11-19');
    expect(applyTeams(g, { ...teamsDraftOf(g), opponent: '  Birch Lake ' }, later).info.opponent).toBe('Birch Lake');
  });

  test('D10: our team name is saved; the rest of the game info is untouched', () => {
    const g = played();
    const after = applyTeams(g, { ...teamsDraftOf(g), team: 'Maple Hill JV' }, later);
    expect(after.info).toEqual({ ...g.info, team: 'Maple Hill JV' });
  });

  test('I6: the save clears exported and stamps updatedAt', () => {
    const g = played();
    const after = applyTeams(g, edited(g), later);
    expect(after.exported).toBeUndefined();
    expect('exported' in after).toBe(false);
    expect(after.updatedAt).toBe(later.toISOString());
  });

  test('a draft that changes nothing returns the same game (no undo step; the export marks still match, I6)', () => {
    const g = played();
    expect(applyTeams(g, teamsDraftOf(g), later)).toBe(g);
  });

  test('I5: the Book CSV differs only in the lines holding the renamed/renumbered player', () => {
    const g = played();
    const d = teamsDraftOf(g);
    const renamed: TeamsDraft = {
      ...d,
      roster: d.roster.map((p) => (p.id === 'h4' ? { ...p, number: '40', name: 'Ada Quill-Ross' } : p)),
      oppRoster: d.oppRoster.map((p) => (p.id === 't2' ? { ...p, number: '21', name: 'Ivy Ostrom' } : p)),
    };
    const before = bookCsv(g).split('\n');
    const after = bookCsv(applyTeams(g, renamed, later)).split('\n');
    expect(after.length).toBe(before.length);
    const changed = before.map((l, i) => [l, after[i]] as const).filter(([b, a]) => b !== a);
    expect(changed.length).toBe(2);
    expect(changed[0][0]).toContain('#4');
    expect(changed[0][1]).toContain('Ada Quill-Ross,#40');
    expect(changed[1][1]).toContain('Ivy Ostrom,#21');
  });

  test('I5: Plays CSV rows keep seq, period, team, event, points and both scores', () => {
    const g = played();
    const cols = (csv: string) =>
      csv.trim().split('\n').map((l) => {
        const c = l.split(',');
        return [c[0], c[1], c[2], c[5], c[6], c[7], c[8]];
      });
    const after = applyTeams(g, edited(g), later);
    expect(cols(playsCsv(after))).toEqual(cols(playsCsv(g)));
    expect(playsCsv(after)).toContain(',40,Ada Quill-Ross,FG2,');
  });
});

describe('lockedPlayerIds (D14)', () => {
  test('holds players with a play and players in a sub with no play; not a player with neither', () => {
    const locked = lockedPlayerIds(played());
    for (const id of ['h4', 'h5', 'h22', 't2', 't3']) expect(locked).toContain(id); // plays
    for (const id of ['h10', 't24', 't20']) expect(locked).toContain(id); // only in a sub
    for (const id of ['h7', 'h12', 'h31', 't11', 't14']) expect(locked).not.toContain(id);
  });

  test('a new game locks no one', () => {
    expect(lockedPlayerIds(newGame(info, ours, now, theirs)).size).toBe(0);
  });
});

describe('Setup validation on an Edit teams draft (Review Focus 2)', () => {
  test('numbers with empty names save with no error, and a default MM-DD opponent stays', () => {
    const g = { ...played(), info: { ...info, opponent: '11-19' } };
    const d = teamsDraftOf(g);
    // Setup's validation, as EditTeams calls it (D11: same validation as Setup).
    expect(setupRosterErrors(d.roster, d.oppRoster)).toEqual([]);
    const after = applyTeams(g, { ...d, oppRoster: cleanOppRoster(d.oppRoster) }, later);
    expect(after.oppRoster.every((p) => p.name === '')).toBe(true);
    expect(after.info.opponent).toBe('11-19');
  });
});
