import { describe, expect, test } from 'vitest';
import { isLateAdd } from './late';
import { newGame } from './events';
import type { Game, GameInfo } from './types';

const info: GameInfo = {
  team: 'Maple Hill', opponent: 'Cedar Run', date: '2026-11-19', homeAway: 'home',
  coach: 'Coach Pell', scorer: 'Scorer Ames', timer: 'Timer Rudd',
};
const g = (): Game => ({ ...newGame(info, [], new Date('2026-11-19T10:00:00Z')), currentPeriod: 3 });

describe('isLateAdd', () => {
  test('the current period of a game in progress is not late (D10)', () => {
    expect(isLateAdd(g(), 3)).toBe(false);
  });
  test('an earlier period is late (D10, D11)', () => {
    expect(isLateAdd(g(), 2)).toBe(true);
  });
  test('any period is late once the game has ended (D13)', () => {
    expect(isLateAdd({ ...g(), endedAt: '2026-11-19T11:00:00Z' }, 3)).toBe(true);
  });
});
