import { describe, expect, it } from 'vitest';
import { HOWTO_SECTIONS } from './howto-content';
import { MARK_LEGEND } from './running-logic';

const byTitle = (t: string) => HOWTO_SECTIONS.find((s) => s.title === t)!;
const text = (t: string) => byTitle(t).body.join(' ');

describe('how-to content', () => {
  it('has the twelve sections in order', () =>
    expect(HOWTO_SECTIONS.map((s) => s.title)).toEqual([
      'What this is', 'Before tip-off', 'Record a play', 'Free throws', 'Timeouts and bench techs',
      'Their points', 'Mistakes', 'End of quarter', 'Overtime and end of game', 'Export',
      'Reading the screen', "If something's wrong",
    ]));
  it('keeps each section short', () => HOWTO_SECTIONS.forEach((s) => expect(s.body.length).toBeLessThanOrEqual(2)));
  it('gives every section a distinct id', () =>
    expect(new Set(HOWTO_SECTIONS.map((s) => s.id)).size).toBe(HOWTO_SECTIONS.length));
  it('puts bench techs on the Bench card', () => expect(text('Timeouts and bench techs')).toMatch(/Bench card/));
  it('carries the iPhone home-screen tip and names Game details', () => {
    expect(text('Before tip-off')).toMatch(/Add to Home Screen/);
    expect(text('Before tip-off')).toMatch(/Game details/);
  });
  it('says how to fix a mistake', () => expect(text('Mistakes')).toMatch(/Undo.*Log/));
  it('covers ending early and reopening', () => {
    expect(text('Overtime and end of game')).toMatch(/End game early/);
    expect(text('Overtime and end of game')).toMatch(/Reopen game/);
  });
  it('covers the 72-hour clear and open quarters', () => {
    expect(text('Export')).toMatch(/72 hours/);
    expect(text('Export')).toMatch(/Not checked.*pending/);
    expect(text('Export')).toMatch(/Mismatch.*unresolved/);
  });
  it('carries the running-score legend', () => expect(text('Reading the screen')).toContain(MARK_LEGEND));
  it('points to the Setup update button', () => expect(text("If something's wrong")).toMatch(/Setup shows .*Update available/));
  it('covers the banner and what a reload clears', () => {
    expect(text("If something's wrong")).toMatch(/Not saving/);
    expect(text("If something's wrong")).toMatch(/reload keeps your plays but clears Undo/);
  });
});
