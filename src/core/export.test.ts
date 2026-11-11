import { describe, expect, test } from 'vitest';
import { bookCsv } from './export-book';
import { exportFilename, playsCsv } from './export-plays';
import { appendEvent, editEvent, insertEventBefore, newGame, orderedEvents } from './events';
import { derive } from './derive';
import { saveReconcile } from './reconcile';
import type { EventDraft, Game, GameInfo, Player } from './types';

const info: GameInfo = {
  team: 'Team A', opponent: "St. Mary's", date: '2026-11-14', homeAway: 'home',
  coach: 'Coach One', scorer: 'Scorer One', timer: 'Timer One',
};
const roster: Player[] = [
  { id: 'p0', number: '0', name: 'Player Zero', pos: 'G' },
  { id: 'p00', number: '00', name: 'Player Double', pos: 'F' },
  { id: 'p4', number: '4', name: 'Player Four', pos: 'C' },
];
const now = new Date('2026-11-14T10:00:00Z');
const game = (): Game => newGame(info, roster, now);
function add(g: Game, period: number, ...ds: EventDraft[]): Game {
  return ds.reduce((a, d) => appendEvent(a, { ...d, period }, now), g);
}

// Minimal RFC 4180 reader (strips the BOM) so tests assert on cells, not substrings.
function parse(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  const s = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\r' && s[i + 1] === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; }
    else cur += c;
  }
  row.push(cur);
  rows.push(row);
  return rows;
}
const rowOf = (rows: string[][], first: string, after = 0) =>
  rows.slice(after).find((r) => r[0] === first)!;
const scoreRow = (rows: string[][], first: string) =>
  rowOf(rows, first, rows.findIndex((r) => r[0] === 'Score by period'));
const withName = (g: Game, id: string, name: string): Game => ({
  ...g, roster: g.roster.map((p) => (p.id === id ? { ...p, name } : p)),
});

function sample(): Game {
  let g = add(game(), 1,
    { type: 'FG2', playerId: 'p4' }, { type: 'FG2', playerId: 'p4' },
    { type: 'FTM', playerId: 'p4' }, { type: 'FTX', playerId: 'p4' });
  g = add(g, 1, { type: 'FG3', playerId: 'p00' }, { type: 'OPP_PTS', oppPoints: 2 });
  return g;
}

describe('bookCsv', () => {
  test('keeps #00 distinct from #0 as separate player rows', () => {
    const rows = parse(bookCsv(sample()));
    const head = rows.findIndex((r) => r[0] === 'POS');
    const nos = rows.slice(head + 1, head + 4).map((r) => r[2]);
    expect(nos).toEqual(['#0', '#00', '#4']);
  });

  test('period marks cell is "2 2 FT 0" and TEAM TOTALS TP equals usTotal', () => {
    const g = sample();
    const rows = parse(bookCsv(g));
    const head = rows.find((r) => r[0] === 'POS')!;
    const p4 = rows.find((r) => r[2] === '#4')!;
    expect(p4[head.indexOf('Q1')]).toBe('2 2 FT 0');
    expect(p4[head.indexOf('Q2')]).toBe('');
    const tot = rowOf(rows, 'TEAM TOTALS');
    expect(tot[head.indexOf('TP')]).toBe(String(derive(g).usTotal));
    expect(tot[head.indexOf('TP')]).toBe('8');
    expect(tot[head.indexOf("2'S")]).toBe('2');
  });

  test('score by period: book number as-is, app sum starred, opponent uses book else taps', () => {
    let g = { ...sample(), trackOpponentTaps: true }; // app Q1 = 8, opp tap Q1 = 2
    g = saveReconcile(g, 1, 8, 5, '', now);
    let rows = parse(bookCsv(g));
    let us = scoreRow(rows, 'Team A');
    expect(us.slice(1, 6)).toEqual(['8', '0*', '0*', '0*', '8*']);
    expect(scoreRow(rows, "St. Mary's").slice(1, 6)).toEqual(['5', '0', '0', '0', '5']);
    g = saveReconcile(g, 1, null, null, '', now);
    g = saveReconcile(g, 2, 0, 0, '', now);
    g = saveReconcile(g, 3, 0, 0, '', now);
    g = saveReconcile(g, 4, 0, 0, '', now);
    g = saveReconcile(g, 1, 8, null, '', now);
    rows = parse(bookCsv(g));
    us = scoreRow(rows, 'Team A');
    expect(us.slice(1, 6)).toEqual(['8', '0', '0', '0', '8']);
    expect(scoreRow(rows, "St. Mary's").slice(1, 6)).toEqual(['2', '0', '0', '0', '2']);
  });

  test('with taps off, an opponent period nobody entered prints blank; an entered one still prints', () => {
    const g = saveReconcile(sample(), 1, 8, null, '', now); // taps off: the Q1 tap of 2 is not a figure anyone counted
    expect(scoreRow(parse(bookCsv(g)), "St. Mary's").slice(1, 5)).toEqual(['', '', '', '']);
    const h = saveReconcile(g, 2, 0, 7, '', now);
    expect(scoreRow(parse(bookCsv(h)), "St. Mary's").slice(1, 5)).toEqual(['', '7', '', '']);
  });

  test('OT columns appear only when currentPeriod > 4', () => {
    const g = { ...sample(), currentPeriod: 5 };
    const rows = parse(bookCsv(g));
    expect(rows.find((r) => r[0] === 'POS')!).toContain('OT1');
    expect(parse(bookCsv(sample())).find((r) => r[0] === 'POS')!).not.toContain('OT1');
  });

  test('an unresolved period shows "unresolved" and its diff; taps vs opp book both listed', () => {
    const g = saveReconcile(sample(), 1, 10, 4, '', now); // app 8, book 10
    const rows = parse(bookCsv(g));
    const rec = rows.findIndex((r) => r[0] === 'Reconcile');
    expect(rows[rec + 1]).toEqual(['Period', 'Book', 'App', 'Diff', 'Status', 'Opp book', 'Opp taps', 'Note']);
    expect(rows[rec + 2]).toEqual(['Q1', '10', '8', '2', 'unresolved', '4', '2', '']);
    expect(rows[rec + 3]).toEqual(['Q2', '', '0', '', 'pending', '', '0', '']);
  });

  test('fouls, bench techs and timeouts blocks', () => {
    let g = add(game(), 2, { type: 'FOUL', playerId: 'p4' }, { type: 'BENCH_TECH' },
      { type: 'TIMEOUT', timeoutKind: 'full' });
    g = withName(g, 'p4', 'O"Neil, Jr.');
    const rows = parse(bookCsv(g));
    expect(rows.filter((r) => r[0] === 'Team fouls').map((r) => r.slice(1))).toEqual([
      ['Q1', '0'], ['Q2', '2'], ['Q3', '0'], ['Q4', '0'],
    ]);
    expect(rowOf(rows, 'Bench technicals')[1]).toBe('1');
    expect(rows.filter((r) => r[0] === 'Timeouts used').map((r) => r.slice(1))).toEqual([
      ['Full', '1 of 3'], ['30', '0 of 2'], ['OT', '0 of 0'],
    ]);
    expect(rows.find((r) => r[2] === '#4')![1]).toBe('O"Neil, Jr.');
  });

  test('formula-like text is guarded with a leading quote; negative numbers are not', () => {
    const g = saveReconcile(withName(sample(), 'p4', '=SUM(1)'), 1, 6, null, '+note', now); // diff -2
    const rows = parse(bookCsv(g));
    expect(rows.find((r) => r[2] === '#4')![1]).toBe("'=SUM(1)");
    const rec = rows.findIndex((r) => r[0] === 'Reconcile');
    expect(rows[rec + 2].slice(0, 8)).toEqual(['Q1', '6', '8', '-2', 'noted', '', '2', "'+note"]);
  });

  test('header block and BOM', () => {
    const csv = bookCsv(game());
    expect(csv.startsWith('\uFEFFTeam,Opponent,Date,Home/Away,Coach,Scorer,Timer\r\n')).toBe(true);
    expect(csv.split('\uFEFF').length).toBe(2);
    expect(parse(csv)[1]).toEqual(['Team A', "St. Mary's", '2026-11-14', 'home', 'Coach One', 'Scorer One', 'Timer One']);
  });
});

describe('playsCsv', () => {
  test('one row per event in order; us_score climbs 2, 3, 6; edited shows yes', () => {
    let g = add(game(), 1, { type: 'FG2', playerId: 'p4' }, { type: 'FG3', playerId: 'p4' },
      { type: 'FTM', playerId: 'p0' }, { type: 'FTX', playerId: 'p0' }, { type: 'OPP_PTS', oppPoints: 3 });
    g = editEvent(g, orderedEvents(g)[1].id, { type: 'FG2', playerId: 'p4' }, now);
    const rows = parse(playsCsv(g));
    expect(rows[0]).toEqual(['seq', 'period', 'team', 'number', 'player', 'event', 'points',
      'us_score', 'opp_score', 'entered_at', 'edited', 'detail']);
    expect(rows.length).toBe(1 + orderedEvents(g).length);
    expect(rows.slice(1).map((r) => r[0])).toEqual(['1', '2', '3', '4', '5']);
    expect(rows.slice(1, 4).map((r) => r[7])).toEqual(['2', '4', '5']);
    expect(rows[1].slice(1, 7)).toEqual(['Q1', 'us', '4', 'Player Four', 'FG2', '2']);
    expect(rows[4].slice(5, 8)).toEqual(['FTX', '0', '5']);
    expect(rows[5].slice(2, 9)).toEqual(['opp', '', '', 'OPP_PTS', '3', '5', '3']);
    expect(rows.map((r) => r[10]).slice(1)).toEqual(['no', 'yes', 'no', 'no', 'no']);
  });

  test('seq is the row number even when orders are fractional or negative', () => {
    let g = add(game(), 1, { type: 'FG2', playerId: 'p4' }, { type: 'FG2', playerId: 'p4' });
    const [a, b] = orderedEvents(g);
    g = insertEventBefore(g, b.id, { type: 'FOUL', playerId: 'p4' }, now); // order 0.5
    g = insertEventBefore(g, a.id, { type: 'FOUL', playerId: 'p0' }, now); // order -1
    expect(parse(playsCsv(g)).slice(1).map((r) => r[0])).toEqual(['1', '2', '3', '4']);
  });

  test('TIMEOUT rows carry their kind in detail; others leave it empty', () => {
    const g = add(game(), 1, { type: 'TIMEOUT', timeoutKind: 'thirty' }, { type: 'FG2', playerId: 'p4' });
    const rows = parse(playsCsv(g));
    expect(rows[1][5]).toBe('TIMEOUT');
    expect(rows[1][11]).toBe('thirty');
    expect(rows[2][11]).toBe('');
  });

  test('plays CSV stays raw for formula-like text', () => {
    const rows = parse(playsCsv(add(withName(game(), 'p4', '=SUM(1)'), 1, { type: 'FG2', playerId: 'p4' })));
    expect(rows[1][4]).toBe('=SUM(1)');
  });

  test('non-scoring events leave points empty; keeps raw 00 and BOM', () => {
    const g = add(game(), 1, { type: 'FOUL', playerId: 'p00' });
    const csv = playsCsv(g);
    expect(csv.startsWith('\uFEFFseq,')).toBe(true);
    const r = parse(csv)[1];
    expect(r[3]).toBe('00');
    expect(r[6]).toBe('');
  });
});

describe('exportFilename', () => {
  test('slugs the opponent', () => {
    expect(exportFilename(game(), 'book')).toBe('bench-book_2026-11-14_st-mary-s_book.csv');
    expect(exportFilename({ ...game(), info: { ...info, opponent: '  Lincoln Jr. High! ' } }, 'plays'))
      .toBe('bench-book_2026-11-14_lincoln-jr-high_plays.csv');
    expect(exportFilename(game(), 'plays')).toBe('bench-book_2026-11-14_st-mary-s_plays.csv');
  });
});
