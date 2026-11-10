import { describe, expect, it } from 'vitest';
import type { PeriodCheck } from '../core/reconcile';
import {
  endPeriodLabel, mayEndGame, oppLabel, playLabel, reconcileBanner, timeoutLabel, timeoutsText,
} from './live-logic';

const issue = (period: number, status: PeriodCheck['status']): PeriodCheck => ({
  period, appUs: 0, bookUs: null, diff: null, bookOpp: null, oppTapped: 0, status, note: '',
});

describe('labels', () => {
  it('names each play with the jersey number', () => {
    expect(playLabel('FG2', '4')).toBe('#4 +2');
    expect(playLabel('FG3', '12')).toBe('#12 +3');
    expect(playLabel('FTM', '4')).toBe('#4 FT ✓');
    expect(playLabel('FTX', '4')).toBe('#4 FT ✗');
    expect(playLabel('FOUL', '4')).toBe('#4 Foul');
    expect(playLabel('TECH', '4')).toBe('#4 Tech');
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
    expect(timeoutsText(t, 4)).toBe('Full 2/3 · 30 2/2');
  });
  it('shows OT timeouts in overtime', () => {
    expect(timeoutsText(t, 6)).toBe('Full 2/3 · 30 2/2 · OT 1/2');
  });
  it('never goes negative when more timeouts are used than allowed', () => {
    expect(timeoutsText({ ...t, full: { used: 5, total: 3 } }, 1)).toBe('Full 0/3 · 30 2/2');
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
