import { toCsv } from './csv';
import { POINTS } from './derive';
import { orderedEvents } from './events';
import { periodLabel } from './periods';
import type { Game } from './types';

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function exportFilename(g: Game, kind: 'book' | 'plays'): string {
  return `bench-book_${g.info.date}_${slug(g.info.opponent)}_${kind}.csv`;
}

export function playsCsv(g: Game): string {
  const byId = new Map(g.roster.map((p) => [p.id, p]));
  const rows: (string | number)[][] = [[
    'seq', 'period', 'team', 'number', 'player', 'event', 'points', 'us_score', 'opp_score',
    'entered_at', 'edited',
  ]];
  let us = 0;
  let opp = 0;
  for (const e of orderedEvents(g)) {
    let points: number | '' = '';
    if (e.type === 'FG2' || e.type === 'FG3' || e.type === 'FTM') {
      points = POINTS[e.type];
      us += points;
    } else if (e.type === 'FTX') {
      points = 0;
    } else if (e.type === 'OPP_PTS') {
      points = e.oppPoints ?? 0;
      opp += points;
    }
    const p = e.playerId ? byId.get(e.playerId) : undefined;
    rows.push([
      e.order, periodLabel(e.period), e.type === 'OPP_PTS' ? 'opp' : 'us', p?.number ?? '',
      p?.name ?? '', e.type, points, us, opp, e.enteredAt, e.editedAt ? 'yes' : 'no',
    ]);
  }
  return toCsv(rows);
}
