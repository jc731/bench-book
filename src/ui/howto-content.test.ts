import { describe, expect, it } from 'vitest';
import { HOWTO_SECTIONS } from './howto-content';
import { MARK_LEGEND } from './running-logic';

// The PNGs under public/howto, keyed by their served path (/howto/x.png). A glob rather than
// node:fs, which this project has no types for.
const PUBLIC_PNGS = Object.keys(import.meta.glob('../../public/howto/*.png')).map((k) => k.replace('../../public', ''));

const byTitle = (t: string) => HOWTO_SECTIONS.find((s) => s.title === t)!;
const text = (t: string) => byTitle(t).body.join(' ');

describe('how-to content', () => {
  it('has the thirteen sections in order', () =>
    expect(HOWTO_SECTIONS.map((s) => s.title)).toEqual([
      'What this is', 'Before tip-off', 'Record a play', 'Free throws', 'A player with no row', 'Subs',
      'Timeouts and bench techs', 'Mistakes', 'End of quarter', 'Overtime and end of game', 'Export',
      'Reading the screen', "If something's wrong",
    ]));
  it('keeps each section short', () => HOWTO_SECTIONS.forEach((s) => expect(s.body.length).toBeLessThanOrEqual(2)));
  it('gives every section a distinct id', () =>
    expect(new Set(HOWTO_SECTIONS.map((s) => s.id)).size).toBe(HOWTO_SECTIONS.length));
  // 1.1 spec "The list and the swap": the bench-tech button reads Tech, beside + Play, with an amber count.
  it('puts bench techs on the Tech button beside + Play', () => expect(text('Timeouts and bench techs')).toMatch(/Tech button, beside \+ Play.*amber.*Tech 2/));
  it('puts each team\'s timeouts under its Tech button, with the guard at zero', () => {
    expect(text('Timeouts and bench techs')).toMatch(/buttons under its Tech button/);
    expect(text('Timeouts and bench techs')).toMatch(/Full: 3.*OT: 1/);
    expect(text('Timeouts and bench techs')).toMatch(/At 0 .*Take one anyway/);
  });
  it('lays out Home and Away and the US tag', () => {
    expect(text('Record a play')).toMatch(/Home is on the left with light rows, Away on the right with dark ones/);
    expect(text('Record a play')).toMatch(/US tag/);
  });
  // 1.1 spec "Decided by the owner" 1-3 and the Constraints list.
  it('explains one-tap rows: +2 and Foul, the number for the rest, the scrolling list', () => {
    const t = text('Record a play');
    expect(t).toMatch(/Each player is a row with their number.*no names/);
    expect(t).toMatch(/\+2 and Foul are one tap on the row/);
    expect(t).toMatch(/Tap the number.*\+3, free throws, a tech, fixes and subs/);
    expect(t).toMatch(/list scrolls/);
  });
  it('says the 2 s move-up, the flash, the scroll back and the half-second guard', () => {
    const t = text('Subs');
    expect(t).toMatch(/Two seconds after you stop tapping or scrolling.*moves up into the top five/);
    expect(t).toMatch(/flash blue and the list scrolls back to the top/);
    expect(t).toMatch(/half a second.*\+2 and Foul on that half ignore taps/);
  });
  it('gives the first-use tip verbatim', () =>
    expect(text('Reading the screen')).toContain('Tap a number for 3s, free throws and fixes.'));
  it('explains + Play and Whose number?', () => {
    const t = text('A player with no row');
    for (const words of ['+ Play', 'Whose number?', 'No number', 'Stop asking this game', 'joins that team']) expect(t).toContain(words);
  });
  it('covers the floor and bench, Starters, the sub row and the three questions', () => {
    const t = text('Subs');
    expect(t).toMatch(/Every row looks the same: the five on the floor come first, and the rows after them are a shade grayer \(Home\) or darker \(Away\)/);
    expect(t).toMatch(/Starters/);
    expect(t).toMatch(/until that team's first play[^.]*, then Sub\./);
    expect(t).toMatch(/Subbing is optional: a bench player who makes a play goes on the floor/);
    expect(t).toMatch(/tap the #22 number, then #22 checks in/);
    for (const q of ['Who went out?', 'Who came in?', "Who's on the floor?"]) expect(t).toContain(q);
    expect(t).toMatch(/longest without a play/);
    expect(t).toMatch(/only a hint/);
    expect(t).not.toMatch(/likely/);
    expect(t).toMatch(/Subs change no score or count/);
  });
  it('makes both rosters optional and keeps only ours', () => {
    expect(text('Before tip-off')).toMatch(/their roster.*Both are optional/);
    expect(text('Before tip-off')).toMatch(/Theirs is not saved/);
  });
  it('points to Edit teams for fixing rosters mid-game (Task 5 brief, Step 8)', () =>
    expect(text('Before tip-off')).toContain('Fix a number, add a name or add a player mid-game: ⋯ → Edit teams.'));
  it('says Add play stays on the check and their score only warns', () => {
    expect(text('End of quarter')).toMatch(/Add play \(pick the team first[^)]*\); it stays there after the score matches/);
    expect(text('End of quarter')).toMatch(/Their score only warns/);
  });
  it('says the team-fouls count includes Q4 in overtime', () => {
    expect(text('Reading the screen')).toMatch(/in overtime the count includes Q4/);
  });
  it('drops the controls 0.8 removed', () => {
    // "Add a player" is the removed control's label, so case-sensitive: Edit teams' "add a player mid-game" is prose.
    const all = HOWTO_SECTIONS.map((s) => `${s.title} ${s.body.join(' ')} ${s.image?.alt ?? ''}`).join(' ');
    for (const gone of [/Opp \+/, /keep(ing)? their (score|points)/i, /Add a player/, /Timeout opens/, /timeouts left at the top/])
      expect(all).not.toMatch(gone);
  });
  it('carries the iPhone home-screen tip and names Game details', () => {
    expect(text('Before tip-off')).toMatch(/Add to Home Screen/);
    expect(text('Before tip-off')).toMatch(/Game details/);
  });
  it('says how to fix a mistake', () => expect(text('Mistakes')).toMatch(/Undo.*Book.*Plays/));
  it('covers ending early and reopening', () => {
    expect(text('Overtime and end of game')).toMatch(/End game early/);
    expect(text('Overtime and end of game')).toMatch(/Reopen game/);
  });
  it('covers the 72-hour clear and open quarters', () => {
    expect(text('Export')).toMatch(/72 hours/);
    expect(text('Export')).toMatch(/Not checked.*pending/);
    expect(text('Export')).toMatch(/Mismatch.*unresolved/);
  });
  it('carries the running-score legend, ours only', () => {
    expect(text('Reading the screen')).toContain(MARK_LEGEND);
    expect(text('Reading the screen')).toMatch(/Running score.*your team only/);
  });
  it('points to the Setup update button', () => expect(text("If something's wrong")).toMatch(/Setup shows .*Update available/));
  it('covers the banner and what a reload clears', () => {
    expect(text("If something's wrong")).toMatch(/Not saving/);
    expect(text("If something's wrong")).toMatch(/reload keeps your plays but clears Undo/);
  });
  it('shows the four screenshots the release script writes, and no others', () => {
    const IMAGES: Record<string, string> = {
      Subs: '/howto/subs.png',
      'Reading the screen': '/howto/reading-the-screen.png',
      Mistakes: '/howto/mistakes.png',
      'End of quarter': '/howto/end-of-quarter.png',
    };
    for (const s of HOWTO_SECTIONS) expect(s.image?.src, s.title).toBe(IMAGES[s.title]);
  });
  it('points every image at a PNG under public/, with alt text', () => {
    for (const s of HOWTO_SECTIONS.filter((x) => x.image)) {
      expect(s.image!.src).toMatch(/\.png$/);
      expect(s.image!.alt.length).toBeGreaterThan(0);
      expect(PUBLIC_PNGS, s.image!.src).toContain(s.image!.src);
    }
  });
});
