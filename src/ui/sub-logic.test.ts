import { describe, expect, it } from 'vitest';
import { closesNow, netSub, openSub, pickText, subRowText, toggleFloor } from './sub-logic';

const five = ['a', 'b', 'c', 'd', 'e'];
const view = (floor: string[], o: { outIds?: string[]; playedYet?: boolean } = {}) => ({
  floor, outIds: o.outIds ?? [], playedYet: o.playedYet ?? true,
});

describe('openSub', () => {
  it('opens in the mode the floor needs', () => {
    expect(openSub(view([...five, 'f']), null)).toEqual({ mode: 'out', floor: [...five, 'f'] });
    expect(openSub(view(five.slice(0, 4)), null)).toEqual({ mode: 'in', floor: five.slice(0, 4) });
    expect(openSub(view(five), null)).toEqual({ mode: 'set', floor: five });
  });
  it('Starters, before the first play, always asks who is on the floor', () => {
    expect(openSub(view(five, { playedYet: false }), null).mode).toBe('set');
    expect(openSub(view(five.slice(0, 4), { playedYet: false }), null).mode).toBe('set');
  });
  it('a bench player checking in is already on, so it asks who went out', () => {
    expect(openSub(view(five), { in: 'f' })).toEqual({ mode: 'out', floor: [...five, 'f'] });
    // Even before the first play: the row says who moved, so the floor's size picks the mode.
    expect(openSub(view(five, { playedYet: false }), { in: 'f' }).mode).toBe('out');
  });
  it('a floor player coming out is already off, so it asks who came in', () => {
    expect(openSub(view(five), { out: 'a' })).toEqual({ mode: 'in', floor: ['b', 'c', 'd', 'e'] });
  });
  it('never puts an out player on', () => {
    expect(openSub(view(five, { outIds: ['f'] }), { in: 'f' })).toEqual({ mode: 'set', floor: five });
  });
});

describe('toggleFloor', () => {
  it('takes an on player off and puts an off player on, last', () => {
    expect(toggleFloor(five, 'b', [])).toEqual(['a', 'c', 'd', 'e']);
    expect(toggleFloor(['a'], 'f', [])).toEqual(['a', 'f']);
  });
  it('leaves an out player off', () => {
    expect(toggleFloor(['a'], 'f', ['f'])).toEqual(['a']);
  });
});

describe('closesNow', () => {
  it('closes "went out" and "came in" at five, never "who\'s on the floor"', () => {
    expect(closesNow('out', five)).toBe(true);
    expect(closesNow('in', five)).toBe(true);
    expect(closesNow('out', [...five, 'f'])).toBe(false);
    expect(closesNow('in', five.slice(0, 4))).toBe(false);
    expect(closesNow('set', five)).toBe(false);
  });
});

describe('netSub', () => {
  it('is the net change: a player moved and moved back is neither in nor out', () => {
    expect(netSub(five, ['b', 'c', 'd', 'e', 'f'])).toEqual({ ins: ['f'], outs: ['a'] });
    expect(netSub(five, five)).toEqual({ ins: [], outs: [] });
    expect(netSub([...five, 'f'], five)).toEqual({ ins: [], outs: ['f'] });
    // Ins in the order tapped, outs in floor order.
    expect(netSub(five, ['c', 'd', 'e', 'h', 'g'])).toEqual({ ins: ['h', 'g'], outs: ['a', 'b'] });
  });
});

describe('subRowText', () => {
  const l = { floor: five, outIds: ['z'] };
  it('reads "checks in" on the bench, "comes out" on the floor, nothing for an out player', () => {
    expect(subRowText(l, 'f', '22')).toBe('#22 checks in');
    expect(subRowText(l, 'a', '10')).toBe('#10 comes out');
    expect(subRowText(l, 'z', '8')).toBeNull();
  });
});

describe('pickText: "Who went out?" and "Who came in?" say how many to pick', () => {
  it('counts the floor and how many taps bring it to five', () => {
    expect(pickText('out', 8)).toBe('8 on · pick 3');
    expect(pickText('out', 6)).toBe('6 on · pick 1');
    expect(pickText('in', 3)).toBe('3 on · pick 2');
    expect(pickText('in', 4)).toBe('4 on · pick 1');
  });
  it('updates with each tap, including one taken back', () => {
    expect(pickText('out', 7)).toBe('7 on · pick 2');
    expect(pickText('out', 8)).toBe('8 on · pick 3');
  });
  it('"Who\'s on the floor?" has its own count and Done, so no pick line', () => {
    expect(pickText('set', 5)).toBeNull();
    expect(pickText('set', 3)).toBeNull();
  });
});
