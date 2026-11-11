import { describe, expect, it } from 'vitest';
import type { Mark } from '../core/running';
import { MARK_LEGEND, buildCells } from './running-logic';

const m = (score: number, mark: Mark['mark'], over: Partial<Mark> = {}): Mark => ({
  score, mark, number: '4', period: 1, endsPeriod: false, ...over,
});

describe('buildCells', () => {
  it('a 2 landing on 2 marks cell 2 and passes through cell 1', () => {
    const c = buildCells([m(2, 'X')]);
    expect(c[1]).toMatchObject({ n: 2, mark: 'X', number: '4', passedThrough: false });
    expect(c[0]).toMatchObject({ n: 1, passedThrough: true });
    expect(c[0].mark).toBeUndefined();
    expect(c[2].passedThrough).toBe(false); // beyond the score
  });
  it('a 3 from 2 to 5 passes through 3 and 4', () => {
    const c = buildCells([m(2, 'X'), m(5, '●', { number: '12' })]);
    expect(c[2].passedThrough).toBe(true);
    expect(c[3].passedThrough).toBe(true);
    expect(c[4]).toMatchObject({ n: 5, mark: '●', number: '12', passedThrough: false });
  });
  it('is 112 cells by default and extends in whole rows past it', () => {
    expect(buildCells([]).length).toBe(112);
    expect(buildCells([m(120, '●')]).length).toBe(128);
  });
  it('endsPeriod sets the label', () => {
    const c = buildCells([m(2, 'X', { endsPeriod: true }), m(3, '/', { period: 5, endsPeriod: true })]);
    expect(c[1]).toMatchObject({ endsPeriod: true, periodLabel: 'Q1' });
    expect(c[2]).toMatchObject({ endsPeriod: true, periodLabel: 'OT1' });
    expect(c[0].periodLabel).toBeUndefined();
  });
});

describe('MARK_LEGEND', () => {
  it('names every mark', () => ['X', '●', '/'].forEach((m) => expect(MARK_LEGEND).toContain(m)));
  it('names the shaded cells and the amber edge', () => {
    expect(MARK_LEGEND).toMatch(/shaded/);
    expect(MARK_LEGEND).toMatch(/amber/);
  });
});
