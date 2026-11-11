import { expect, test, type Locator, type Page } from '@playwright/test';
import { downloadCsv } from './csv';

/*
 * Full-game release test: one whole game played the way a fluent scorer plays it, with every
 * expected number worked out BY HAND from the table below. Nothing here imports from src/, so
 * a regression in the app's own arithmetic cannot also move the expected values.
 *
 * Roster (invented names), opponent taps ON, team "Test Home" vs "Test Opp":
 *   G Player One #4 · F Player Two #00 · C Player Three #0 · G Player Four #12
 *   F Player Five #23 · F Player Six #31 · C Player Seven #44
 *
 * Us / Opp are the status strip after the event (Opp = taps; every book opponent figure typed
 * below equals that period's taps, so the strip never changes on a save). TF = team fouls in
 * the period on the strip (OT1 shows Q4 + OT1).
 *
 *  ev | per | event                                  |  Us | Opp | TF | notes
 *  ---+-----+----------------------------------------+-----+-----+----+-----------------------------
 *   1 | Q1  | #4  Player One    +2                   |   2 |   0 |  0 |
 *   2 | Q1  | Opp +2                                 |   2 |   2 |  0 |
 *   3 | Q1  | #0  Player Three  +3                   |   5 |   2 |  0 |
 *   4 | Q1  | #12 Player Four   Foul                 |   5 |   2 |  1 | P4 1 foul
 *   5 | Q1  | #00 Player Two    FT made  (sheet open) |   6 |   2 |  1 |
 *   6 | Q1  | #00 Player Two    FT missed (same sheet)|   6 |   2 |  1 |
 *   - | Q1  | #4  Player One    +3  MIS-TAP          |   9 |   2 |  1 | undone -> 6-2, not an event
 *   7 | Q1  | Timeout Full                           |   6 |   2 |  1 | Full 2/3 · 30 2/2
 *   8 | Q1  | Opp +3                                 |   6 |   5 |  1 |
 *   9 | Q1  | #12 Player Four   Foul                 |   6 |   5 |  2 | P4 2
 *  10 | Q1  | #4  Player One    Foul                 |   6 |   5 |  3 | P1 1
 *  11 | Q1  | #23 Player Five   +2                   |   8 |   5 |  3 |
 *  12 | Q1  | Opp +1                                 |   8 |   6 |  3 | Q1: us 2+3+1+2 = 8, opp 2+3+1 = 6
 *     |     | End Q1. Check Q1: book 8 / 6           |   8 |   6 |    | MATCHED
 *  13 | Q2  | #31 Player Six    +3                   |  11 |   6 |  0 |
 *  14 | Q2  | Opp +2                                 |  11 |   8 |  0 |
 *  15 | Q2  | #12 Player Four   Foul                 |  11 |   8 |  1 | P4 3
 *  16 | Q2  | #44 Player Seven  +2                   |  13 |   8 |  1 | (a +2 by #31 before this was missed)
 *  17 | Q2  | #12 Player Four   Foul                 |  13 |   8 |  2 | P4 4 -> warning
 *  18 | Q2  | #23 Player Five   Tech                 |  13 |   8 |  3 | P5 1 foul, 1 tech
 *  19 | Q2  | #00 Player Two    Foul                 |  13 |   8 |  4 | no bonus chip yet
 *  20 | Q2  | Bench tech                             |  13 |   8 |  5 | 5th team foul -> bonus pill
 *  21 | Q2  | Opp +2                                 |  13 |  10 |  5 |
 *  22 | Q2  | #00 Player Two    FT made              |  14 |  10 |  5 |
 *  23 | Q2  | #00 Player Two    FT made (same sheet) |  15 |  10 |  5 | Q2 app 3+2+1+1 = 7, opp 2+2 = 4
 *     |     | End Q2 -> Q3 Fouls 0, no chip (reset)  |     |     |  0 |
 *     |     | Check Q2: book 9 / 4 -> app 2 short    |     |     |    | MISMATCH saved
 *  24 | Q2  | ADD #31 Player Six +2 from Check Q2    |  17 |  10 |    | at the end of Q2; Q2 now 9 -> FIXED
 *  25 | Q3  | #4  Player One    +2  (WRONG PLAYER)   |  19 |  10 |  0 | later edited to #0 Player Three
 *  26 | Q3  | Opp +3                                 |  19 |  13 |  0 |
 *  27 | Q3  | #12 Player Four   Foul                 |  19 |  13 |  1 | P4 5 fouls -> OUT
 *  28 | Q3  | Timeout 30                             |  19 |  13 |  1 | Full 2/3 · 30 1/2
 *  29 | Q3  | #23 Player Five   Tech                 |  19 |  13 |  2 | P5 2 techs -> OUT
 *  30 | Q3  | #44 Player Seven  +3                   |  22 |  13 |  2 |
 *  31 | Q3  | Opp +2                                 |  22 |  15 |  2 | Q3 app 2+3 = 5, opp 3+2 = 5
 *  32 | Q3* | #0  Player Three  +2   (End Q3 missed) |  24 |  15 |  2 | really Q4
 *  33 | Q3* | Opp +2                 (End Q3 missed) |  24 |  17 |  2 | really Q4
 *     |     | End Q3 (late). Log: fix ev 32, Quarter Q4 + "Also move" the 1 after it (2 plays)
 *     |     | Log: edit ev 25 player #4 -> #0 (points unchanged: 24-17, Q4 Fouls 0)
 *     |     | Check Q3: book 7 / 5 + note -> app 2 short, left with a note -> NOTED
 *  34 | Q4  | #31 Player Six    Foul                 |  24 |  17 |  1 |
 *  35 | Q4  | #44 Player Seven  Foul                 |  24 |  17 |  2 |
 *  36 | Q4  | Opp +3                                 |  24 |  20 |  2 |
 *  37 | Q4  | #4  Player One    Foul                 |  24 |  20 |  3 | P1 2
 *  38 | Q4  | #00 Player Two    +3                   |  27 |  20 |  3 |
 *  39 | Q4  | #00 Player Two    Foul                 |  27 |  20 |  4 | P2 2, no chip
 *  40 | Q4  | Opp +2                                 |  27 |  22 |  4 |
 *  41 | Q4  | #31 Player Six    FT missed            |  27 |  22 |  4 |
 *  42 | Q4  | #31 Player Six    FT made (same sheet) |  28 |  22 |  4 |
 *  43 | Q4  | Opp +3                                 |  28 |  25 |  4 |
 *  44 | Q4  | Opp +3                                 |  28 |  28 |  4 | TIED. Q4 us 2+3+1 = 6,
 *     |     |                                        |     |     |    |   opp 2+3+2+3+3 = 13
 *     |     | End Q4… -> Start overtime; Q4 unchecked|     |     |    | PENDING
 *     |     | OT1 strip: Fouls 4 (from Q4), no chip; Full 2/3 · 30 1/2 · OT 1/1
 *  45 | OT1 | #0  Player Three  Foul                 |  28 |  28 |  5 | 4 + 1 -> bonus pill
 *  46 | OT1 | Timeout OT                             |  28 |  28 |  5 | OT 0/1
 *  47 | OT1 | #0  Player Three  +2                   |  30 |  28 |  5 |
 *  48 | OT1 | Opp +1                                 |  30 |  29 |  5 |
 *  49 | OT1 | #4  Player One    FT made              |  31 |  29 |  5 |
 *  50 | OT1 | #4  Player One    FT made (same sheet) |  32 |  29 |  5 |
 *  51 | OT1 | Opp +2                                 |  32 |  31 |  5 | OT1 us 2+1+1 = 4, opp 1+2 = 3
 *     |     | End OT1… -> End game. Open issues: Q4, OT1. Check OT1: book 4 / 3 -> MATCHED
 *
 * Events left: Q1 12 + Q2 12 + Q3 7 + Q4 13 + OT1 7 = 51 (the undone mis-tap is gone).
 * Final (app): us 8+9+5+6+4 = 32, opp 6+4+5+13+3 = 31.
 *
 * Book CSV, Score by period (book number where typed, else app sum marked *):
 *            Q1  Q2  Q3  Q4  OT1  Total
 *   us        8   9   7  6*    4   34*    (8+9+7+6+4 = 34; Q3 is the book's 7, not the app's 5)
 *   opp       6   4   5 13*    3  31*     (Q4 from taps, starred)
 * Team fouls per period (raw): Q1 3, Q2 5, Q3 2, Q4 4, OT1 1 = 15 = 14 player fouls + 1 bench T.
 * Timeouts used: Full 1 of 3, 30 1 of 2, OT 1 of 1.
 * Reconcile: Q1 matched (8/8/0) · Q2 fixed (9/9/0) · Q3 noted (7/5/2) · Q4 pending (–/6/–)
 *            · OT1 matched (4/4/0).
 *
 * Players (final, after the edit, the added play and the move):
 *   player         | FOULS | TECHS | 2'S | 3'S | FTA | FTM | TP | marks
 *   #4  One        |   2   |   0   |  1  |  0  |  2  |  2  |  4 | Q1 "2", OT1 "FT FT"; Q3 "" (edited away)
 *   #00 Two        |   2   |   0   |  0  |  1  |  4  |  3  |  6 | Q1 "FT 0", Q2 "FT FT", Q4 "3"
 *   #0  Three      |   1   |   0   |  3  |  1  |  0  |  0  |  9 | Q1 "3", Q3 "2", Q4 "2", OT1 "2"
 *   #12 Four       |   5   |   0   |  0  |  0  |  0  |  0  |  0 | OUT on 5 fouls (Q3)
 *   #23 Five       |   2   |   2   |  1  |  0  |  0  |  0  |  2 | OUT on 2 techs (Q3)
 *   #31 Six        |   1   |   0   |  1  |  1  |  2  |  1  |  6 | Q2 "3 2", Q4 "0 FT"
 *   #44 Seven      |   1   |   0   |  1  |  1  |  0  |  0  |  5 | Q2 "2", Q3 "3"
 *   TEAM TOTALS    |  14   |   2   |  7  |  4  |  8  |  6  | 32 |
 *   (TP: 4+6+9+0+2+6+5 = 32. Points: 7*2 + 4*3 + 6 = 32.)
 */

const ROSTER = [
  { pos: 'G', name: 'Player One', number: '4' },
  { pos: 'F', name: 'Player Two', number: '00' },
  { pos: 'C', name: 'Player Three', number: '0' },
  { pos: 'G', name: 'Player Four', number: '12' },
  { pos: 'F', name: 'Player Five', number: '23' },
  { pos: 'F', name: 'Player Six', number: '31' },
  { pos: 'C', name: 'Player Seven', number: '44' },
] as const;
type Name = (typeof ROSTER)[number]['name'];
const TEAM = 'Test Home';
const OPPONENT = 'Test Opp';
const numberOf = (name: Name) => ROSTER.find((p) => p.name === name)!.number;

/** Check statuses as the Log chips and the open-issues list show them. */
const STATUS = { matched: '✓ Matched', fixed: '✓ Fixed', noted: 'Noted', pending: 'Not checked' } as const;
type Status = keyof typeof STATUS;

// ---- UI wording lives only in this block --------------------------------------------------

/** Timeouts left; `ot` only in an OT period (one OT timeout per OT period, so OT1 has 1). */
interface TimeoutsLeft { full: number; thirty: number; ot?: number }
const timeoutsText = (t: TimeoutsLeft) =>
  `TO left: ${[`Full ${t.full}`, `30s ${t.thirty}`, ...(t.ot === undefined ? [] : [`OT ${t.ot}`])].join(' · ')}`;

function ui(page: Page) {
  const dialog = () => page.getByRole('dialog');
  const strip = () => page.getByRole('banner');
  const nav = () => page.getByRole('navigation');
  const exact = (name: string) => ({ name, exact: true });

  const card = (name: Name) => page.getByRole('button', { name: new RegExp(`^#${numberOf(name)} ${name},`) });

  /** Taps a player, then each play button. FT buttons keep the sheet open for the pair, so close it with Done. */
  async function onPlayer(name: Name, plays: string[], closeWithDone: boolean) {
    await card(name).click();
    for (const p of plays) await dialog().getByRole('button', exact(p)).click();
    if (closeWithDone) await dialog().getByRole('button', exact('Done')).click();
    await expect(dialog()).toHaveCount(0);
  }

  return {
    /** Setup: opponent, our team, opponent taps on, and the whole roster. */
    async fillSetup(opponent: string, team: string) {
      await page.getByLabel('Opponent (required)').fill(opponent);
      await page.getByLabel('Our team (optional)').fill(team);
      await page.getByLabel('Also keep their score (Opp +1/+2/+3)').check();
      for (let i = 0; i < ROSTER.length; i++) {
        if (i > 0) await page.getByRole('button', exact('Add player')).click();
        const n = i + 1;
        await page.getByLabel(`Player ${n} position`).fill(ROSTER[i].pos);
        await page.getByLabel(`Player ${n} name`).fill(ROSTER[i].name);
        await page.getByLabel(`Player ${n} number`).fill(ROSTER[i].number);
      }
    },
    startGame: () => page.getByRole('button', exact('Start game')).click(),
    card,
    score: (name: Name, pts: '+2' | '+3') => onPlayer(name, [pts], false),
    ft: (name: Name, ...made: boolean[]) => onPlayer(name, made.map((m) => (m ? 'FT made' : 'FT missed')), true),
    foul: (name: Name) => onPlayer(name, ['Foul'], false),
    tech: (name: Name) => onPlayer(name, ['Tech foul'], false),
    opp: (n: 1 | 2 | 3) => nav().getByRole('button', exact(`Opp +${n}`)).click(),
    /** The Bench card at the end of the player cards, then its one button. */
    async benchTech() {
      await page.getByRole('button', exact('Bench')).click();
      await dialog().getByRole('button', exact('Bench tech')).click();
      await expect(dialog()).toHaveCount(0);
    },
    /** The bottom bar's last row: Timeout, Undo, Log, the End slot and More, all on one line and at most 48px tall.
     *  The End slot reads `End Qn` while the game is live, or the given text (`Final ▸` once it has ended). */
    async expectBarOneRow(endSlot?: string) {
      const end = endSlot === undefined ? { name: /^End (Q|OT)\d/ } : exact(endSlot);
      const names = [exact('Timeout'), { name: /^Undo/ }, exact('Log'), end, exact('More')];
      const boxes = [];
      for (const n of names) boxes.push((await nav().getByRole('button', n).boundingBox())!);
      expect(new Set(boxes.map((b) => b.y)).size).toBe(1);
      for (const b of boxes) expect(b.height).toBeLessThanOrEqual(48);
      expect(await nav().getByRole('button').filter({ hasNotText: /^Opp \+/ }).count()).toBe(5);
    },
    /** Every card, Bench included, shows with no scrolling, above the feedback line. */
    async expectCardsFit() {
      const grid = page.getByTestId('player-grid');
      expect(await grid.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
      const bench = (await page.getByRole('button', exact('Bench')).boundingBox())!;
      const line = (await page.getByTestId('feedback-text').boundingBox())!;
      expect(bench.y + bench.height).toBeLessThanOrEqual(line.y);
    },
    /** Opens a player's sheet, checks Done is the white primary button, then taps the dimmed backdrop. */
    async dismissByBackdrop(name: Name) {
      await card(name).click();
      await expect(dialog().getByRole('button', exact('Done'))).toHaveClass(/bg-white/);
      await page.mouse.click(10, 10);
      await expect(dialog()).toHaveCount(0);
    },
    /** The feedback entry shows whole: it wraps rather than cutting its tail. */
    async expectEntryWhole() {
      const el = page.getByTestId('feedback-text');
      expect(await el.evaluate((e) => e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight)).toBe(true);
    },
    undo: () => nav().getByRole('button', exact('Undo')).click(),
    async timeout(kind: 'Full' | '30' | 'OT') {
      await nav().getByRole('button', exact('Timeout')).click();
      await dialog().getByRole('button', exact(kind)).click();
      await expect(dialog()).toHaveCount(0);
    },
    /** End Q1–Q3 directly. */
    endPeriod: (label: string) => nav().getByRole('button', exact(`End ${label}`)).click(),
    /** End Q4 or an OT: the button opens a sheet offering Start overtime / End game (no overtime). */
    async endPeriodThen(label: string, choice: 'Start overtime' | 'End game (no overtime)' | 'End game (no more overtime)') {
      await nav().getByRole('button', exact(`End ${label}…`)).click();
      await dialog().getByRole('button', exact(choice)).click();
    },
    /** The check chip on the feedback line, by its full accessible name. */
    banner: (label: string) => page.getByRole('button', exact(`Check ${label} — not checked against the book`)),
    /** On the Check view: type the book's numbers (and a note); the comparison updates as you type. */
    async fillCheck(label: string, us: number, opp: number, note?: string) {
      await page.getByLabel(new RegExp(`Our points in ${label}`)).fill(String(us));
      await page.getByLabel(new RegExp(`Opponent points in ${label}`)).fill(String(opp));
      if (note !== undefined) await page.getByLabel('Note', { exact: true }).fill(note);
      // Leaving a field saves nothing: only Save does. Every field above was left at least once
      // (each fill blurs the one before, and this focus blurs the last). A blur-save would turn
      // the store-driven status chip from "Not checked" at once, so wait two frames for any such
      // render, then the chip must still say unchecked.
      await page.getByLabel(new RegExp(`Our points in ${label}`)).focus();
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      expect(await page.getByTestId('check-status').textContent()).toBe(STATUS.pending);
    },
    /** The check's top line, quarter first. */
    expectAppHas: (label: string, us: number, them: number, gameUs: number, gameThem: number) =>
      expect(page.getByTestId('app-has')).toHaveText(`App has ${label}: Us ${us} · Them ${them} (game ${gameUs}–${gameThem})`),
    expectMismatchHint: () =>
      expect(page.getByTestId('compare-hint')).toHaveText('Add the missing play, fix one below, or write a note and Save.'),
    expectMatches: () => expect(page.getByTestId('compare')).toHaveText('✓ Matches'),
    expectShort: (book: number, app: number) =>
      expect(page.getByTestId('compare')).toHaveText(`Book ${book} · App ${app} — app is ${book - app} short`),
    saveCheck: () => page.getByRole('button', exact('Save')).click(),
    later: () => page.getByRole('button', exact('Later')).click(),
    ourPoints: (label: string) => page.getByLabel(new RegExp(`Our points in ${label}`)),
    /** Check a quarter from the Live banner (the caller saves). */
    async checkQuarter(label: string, us: number, opp: number, note?: string) {
      await this.banner(label).click();
      await this.fillCheck(label, us, opp, note);
    },
    fixRegion: () => page.getByRole('region', exact('Plays to fix')),
    openLog: () => nav().getByRole('button', exact('Log')).click(),
    back: () => page.getByRole('button', exact('Back')).click(),
    logSection: (label: string) => page.getByRole('region', exact(label)),
    /** A Log row's text: `#44 Player Seven · +2`. */
    playText: (name: Name, play: '+2' | '+3') => `#${numberOf(name)} ${name} · ${play}`,
    oppText: (n: 1 | 2 | 3) => `Opp +${n}`,
    /** The Log row starting with `text` (an "edited" tag may follow it). */
    logRow: (scope: Locator, text: string) =>
      scope.getByRole('button', { name: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }),
    /** From the check's "Plays to fix": adds a play at the end of that quarter. */
    async addPlay(label: string, name: Name, pts: '+2' | '+3') {
      await this.fixRegion().getByRole('button', exact(`Add play to ${label}`)).click();
      await dialog().getByRole('button', exact(`#${numberOf(name)} ${name}`)).click();
      await dialog().getByRole('button', exact(pts)).click();
      await expect(dialog()).toHaveCount(0);
      await this.expectToast(`Added #${numberOf(name)} ${pts} to ${label}`);
    },
    /** Taps a row, picks another quarter and ticks "Also move" for the `after` plays that follow it. */
    async moveFrom(rowScope: Locator, fromLabel: string, rowText: string, toLabel: string, after: number) {
      await this.logRow(rowScope, rowText).click();
      await dialog().getByRole('group', exact('Quarter')).getByRole('button', exact(toLabel)).click();
      await dialog().getByRole('checkbox', exact(`Also move the ${after} play${after === 1 ? '' : 's'} after it in ${fromLabel}`)).check();
      await dialog().getByRole('button', exact('Save')).click();
      await expect(dialog()).toHaveCount(0);
      await this.expectToast(`Moved ${after + 1} plays to ${toLabel}`);
    },
    async editPlayer(rowScope: Locator, rowText: string, name: Name) {
      await this.logRow(rowScope, rowText).click();
      await dialog().getByRole('group', exact('Player')).getByRole('button', exact(`#${numberOf(name)} ${name}`)).click();
      await dialog().getByRole('button', exact('Save')).click();
      await expect(dialog()).toHaveCount(0);
    },
    chip: (label: string, status: Status) => page.getByRole('region', exact(label)).getByRole('button', exact(STATUS[status])),
    openEnd: async () => {
      await page.getByRole('button', exact('More')).click();
      await dialog().getByRole('button', exact('Final / export')).click();
    },
    issues: () => page.getByRole('region', exact('Open issues')),
    issue: (label: string, status: Status) =>
      page.getByRole('region', exact('Open issues')).getByText(`${label} · ${STATUS[status]}`, { exact: true }),
    /** The open-issue button: Check for a quarter never checked, Reopen for one noted or off. */
    async reopen(label: string, status: Status) {
      const action = status === 'pending' ? 'Check' : 'Reopen';
      await this.issue(label, status).locator('..').getByRole('button', exact(action)).click();
    },
    expectFinalScore: (us: number, opp: number) =>
      expect(page.getByTestId('final-score')).toHaveText(`${TEAM} ${us} – ${opp} ${OPPONENT}`),
    exportButton: (which: 'Book CSV' | 'Plays CSV') => page.getByRole('button', exact(which)),
    /** Each file's saved state on the Final screen. */
    async expectExportState(book: boolean, plays: boolean) {
      await expect(page.getByTestId('export-state-book')).toHaveText(book ? 'Book CSV ✓ saved' : 'Book CSV — not saved yet');
      await expect(page.getByTestId('export-state-plays')).toHaveText(plays ? 'Plays CSV ✓ saved' : 'Plays CSV — not saved yet');
    },
    /** The opponent box starts blank, with the tap total only as a hint. */
    expectOppHint: (label: string, taps: number) =>
      expect(page.getByLabel(new RegExp(`Opponent points in ${label}`))).toHaveAttribute('placeholder', `${taps} from taps`),

    /** The status strip: score, period, team fouls, bonus chip, timeouts left. */
    async expectStrip(s: { us: number; opp: number; period: string; fouls: number; bonus: boolean; timeouts: TimeoutsLeft }) {
      const h = strip();
      // Nothing on the strip may wrap at 390px: it is two lines high in every state.
      const box = await h.boundingBox();
      expect(box!.height).toBeLessThanOrEqual(STRIP_MAX_HEIGHT);
      await expect(h.getByLabel(`Score ${s.us} to ${s.opp}`)).toBeVisible();
      await expect(h.getByText(s.period, { exact: true })).toBeVisible();
      await expect(h.getByText(`Team fouls ${s.fouls}`, { exact: true })).toBeVisible();
      await expect(h.getByText('Bonus: they shoot FTs', { exact: true })).toHaveCount(s.bonus ? 1 : 0);
      await expect(h.getByText(timeoutsText(s.timeouts), { exact: true })).toBeVisible();
    },
    /** The feedback line above the bottom bar (it stays until the next entry). */
    expectToast: (text: string) => expect(page.getByTestId('feedback-text')).toHaveText(text),
    /** The line shows `text` and the bar's Undo undoes it: the Undo is described by the line. */
    async expectToastUndo(text: string) {
      await expect(page.getByTestId('feedback-text')).toHaveText(text);
      await expect(nav().getByRole('button', exact('Undo'))).toHaveAccessibleDescription(text);
    },
    /** Saving a file is not an edit: the bar's Undo describes no entry. The chip for the quarter
     *  still to check sits beside the entry, which it does not hide. */
    async expectToastNoUndo(pendingLabel: string) {
      await expect(nav().getByRole('button', exact('Undo'))).toHaveAccessibleDescription('');
      await expect(this.banner(pendingLabel)).toHaveText(`Check ${pendingLabel}`);
      expect((await this.banner(pendingLabel).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    },
    /** A player's sheet shows only what was entered while it is open: no stale entry, no Undo. */
    async expectFreshSheet(name: Name) {
      await card(name).click();
      await expect(dialog().getByTestId('sheet-status')).toHaveText('');
      await expect(dialog().getByRole('button', exact('Undo'))).toHaveCount(0);
      await dialog().getByRole('button', exact('Done')).click();
      await expect(dialog()).toHaveCount(0);
    },
    /** From the Final screen to Live. */
    async backToLive() {
      await page.getByRole('button', exact('Back to game')).click();
    },
    /** The 4-foul warning, which shows only as the card's amber border. */
    expectWarning: (name: Name) => expect(card(name)).toHaveClass(/border-amber-400/),
    /** A player card's foul state, through its accessible name (OUT reads ", out"). */
    async expectPlayer(name: Name, points: number, fouls: number, out = false) {
      const n = (k: number, one: string) => `${k} ${one}${k === 1 ? '' : 's'}`;
      const tail = `, ${n(fouls, 'foul')}${out ? ', out' : ''}$`;
      await expect(card(name)).toHaveAccessibleName(new RegExp(`^#${numberOf(name)} ${name}, ${n(points, 'point')}${tail}`));
    },
  };
}

// ---- helpers that are not UI wording ------------------------------------------------------

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
}

/** Two lines plus padding: score line (text-3xl) and the timeouts line. A wrap adds 20px or more. */
const STRIP_MAX_HEIGHT = 80; // measured 77 at 390px, with the bonus pill in OT1

const Q3_NOTE = 'Book shows 7, could not find the other 2';

test('full game: every number on screen and in both CSVs', async ({ page }) => {
  const app = ui(page);
  const FULL_TIMEOUTS = { full: 3, thirty: 2 };

  await test.step('setup: 7 players with #0 and #00, opponent taps on', async () => {
    await page.goto('/');
    await app.fillSetup(OPPONENT, TEAM);
    await expectNoOverflow(page);
    await app.startGame();
    await app.expectStrip({ us: 0, opp: 0, period: 'Q1', fouls: 0, bonus: false, timeouts: FULL_TIMEOUTS });
    await expectNoOverflow(page);
    await app.expectCardsFit();
    await app.expectBarOneRow();
  });

  await test.step('Q1: scoring, FT pair, an undone mis-tap, a full timeout; check matches', async () => {
    await app.score('Player One', '+2');
    await app.expectFreshSheet('Player Three');
    await app.opp(2);
    await app.score('Player Three', '+3');
    await app.foul('Player Four');
    await app.ft('Player Two', true, false);
    await app.expectStrip({ us: 6, opp: 2, period: 'Q1', fouls: 1, bonus: false, timeouts: FULL_TIMEOUTS });

    // Tapping outside the sheet closes it and records nothing; Done is the white primary button.
    await app.dismissByBackdrop('Player One');
    await app.expectStrip({ us: 6, opp: 2, period: 'Q1', fouls: 1, bonus: false, timeouts: FULL_TIMEOUTS });

    await app.score('Player One', '+3'); // mis-tap
    await app.expectStrip({ us: 9, opp: 2, period: 'Q1', fouls: 1, bonus: false, timeouts: FULL_TIMEOUTS });
    await app.undo();
    await app.expectStrip({ us: 6, opp: 2, period: 'Q1', fouls: 1, bonus: false, timeouts: FULL_TIMEOUTS });
    await app.expectPlayer('Player One', 2, 0);

    await app.timeout('Full');
    await app.opp(3);
    await app.foul('Player Four');
    await app.foul('Player One');
    await app.score('Player Five', '+2');
    await app.opp(1);
    await app.expectStrip({ us: 8, opp: 6, period: 'Q1', fouls: 3, bonus: false, timeouts: { full: 2, thirty: 2 } });
    await app.expectPlayer('Player Four', 0, 2);
    await app.expectPlayer('Player One', 2, 1);
    await expectNoOverflow(page);

    await app.endPeriod('Q1');
    await app.expectStrip({ us: 8, opp: 6, period: 'Q2', fouls: 0, bonus: false, timeouts: { full: 2, thirty: 2 } });
    await expect(app.banner('Q1')).toBeVisible();
    await app.banner('Q1').click();
    await expect(page.getByLabel(/Opponent points in Q1/)).toHaveValue('');
    await app.expectOppHint('Q1', 6);
    await app.fillCheck('Q1', 8, 6);
    await app.expectMatches();
    await expectNoOverflow(page);
    await app.saveCheck();
    await expect(app.banner('Q1')).toHaveCount(0);
    await app.expectStrip({ us: 8, opp: 6, period: 'Q2', fouls: 0, bonus: false, timeouts: { full: 2, thirty: 2 } });
  });

  await test.step('Q2: bonus on the 5th team foul (a bench T); check is off, fixed by adding the missed play', async () => {
    await app.score('Player Six', '+3');
    await app.opp(2);
    await app.foul('Player Four');
    await app.score('Player Seven', '+2');
    await app.foul('Player Four');
    await app.expectPlayer('Player Four', 0, 4);
    await app.expectWarning('Player Four');
    await app.tech('Player Five');
    await app.expectPlayer('Player Five', 2, 1);
    await app.foul('Player Two');
    await app.expectStrip({ us: 13, opp: 8, period: 'Q2', fouls: 4, bonus: false, timeouts: { full: 2, thirty: 2 } });
    await app.benchTech();
    await app.expectToast('Bench tech — bonus');
    await app.expectStrip({ us: 13, opp: 8, period: 'Q2', fouls: 5, bonus: true, timeouts: { full: 2, thirty: 2 } });
    await app.opp(2);
    await app.ft('Player Two', true, true);
    await app.expectStrip({ us: 15, opp: 10, period: 'Q2', fouls: 5, bonus: true, timeouts: { full: 2, thirty: 2 } });

    await app.endPeriod('Q2');
    // The count resets for the new quarter.
    await app.expectStrip({ us: 15, opp: 10, period: 'Q3', fouls: 0, bonus: false, timeouts: { full: 2, thirty: 2 } });

    // The book says 9; the app has 7. A +2 by #31 was missed; it is added from the check, at the end of Q2.
    await app.banner('Q2').click();
    await app.expectAppHas('Q2', 7, 4, 15, 10);
    await app.fillCheck('Q2', 9, 4);
    await app.expectShort(9, 7);
    await app.expectMismatchHint();
    await expectNoOverflow(page);
    await app.addPlay('Q2', 'Player Six', '+2');
    await app.expectMatches();
    await app.saveCheck();
    await app.expectToastUndo('Saved Q2 check');
    await app.expectStrip({ us: 17, opp: 10, period: 'Q3', fouls: 0, bonus: false, timeouts: { full: 2, thirty: 2 } });
    await app.expectPlayer('Player Six', 5, 0);
  });

  await test.step('Q3: two foul-outs, a 30 timeout, a wrong player, a missed End Q3; check noted', async () => {
    await app.score('Player One', '+2'); // wrong player: it was #0 Player Three
    await app.opp(3);
    await app.foul('Player Four');
    await app.expectToast('#12 Player Four foul — 5th, out');
    await app.expectEntryWhole();
    await app.expectCardsFit();
    await app.expectPlayer('Player Four', 0, 5, true);
    await app.timeout('30');
    await app.tech('Player Five');
    await app.expectPlayer('Player Five', 2, 2, true);
    await app.score('Player Seven', '+3');
    await app.opp(2);
    await app.expectStrip({ us: 22, opp: 15, period: 'Q3', fouls: 2, bonus: false, timeouts: { full: 2, thirty: 1 } });

    // Q4 has started but End Q3 was never tapped.
    await app.score('Player Three', '+2');
    await app.opp(2);
    await app.expectStrip({ us: 24, opp: 17, period: 'Q3', fouls: 2, bonus: false, timeouts: { full: 2, thirty: 1 } });
    await app.endPeriod('Q3');
    await app.expectStrip({ us: 24, opp: 17, period: 'Q4', fouls: 0, bonus: false, timeouts: { full: 2, thirty: 1 } });

    await app.openLog();
    const q3 = app.logSection('Q3');
    await app.moveFrom(q3, 'Q3', app.playText('Player Three', '+2'), 'Q4', 1);
    const q4 = app.logSection('Q4');
    await expect(app.logRow(q4, app.playText('Player Three', '+2'))).toBeVisible();
    await expect(app.logRow(q4, app.oppText(2))).toBeVisible();
    await app.editPlayer(q3, app.playText('Player One', '+2'), 'Player Three');
    await expect(app.logRow(q3, app.playText('Player Three', '+2'))).toContainText('edited');
    await expect(app.logRow(q3, app.playText('Player One', '+2'))).toHaveCount(0);
    await expectNoOverflow(page);
    await app.back();
    await app.expectStrip({ us: 24, opp: 17, period: 'Q4', fouls: 0, bonus: false, timeouts: { full: 2, thirty: 1 } });
    await app.expectPlayer('Player One', 2, 1);
    await app.expectPlayer('Player Three', 7, 0);

    await expect(app.banner('Q3')).toBeVisible();
    await app.checkQuarter('Q3', 7, 5, Q3_NOTE);
    await app.expectShort(7, 5);
    await app.saveCheck();
    await expect(app.banner('Q3')).toHaveCount(0);
    await app.expectStrip({ us: 24, opp: 17, period: 'Q4', fouls: 0, bonus: false, timeouts: { full: 2, thirty: 1 } });
  });

  await test.step('Q4: ends tied, left unchecked; Start overtime', async () => {
    await app.foul('Player Six');
    await app.foul('Player Seven');
    await app.opp(3);
    await app.foul('Player One');
    await app.score('Player Two', '+3');
    await app.foul('Player Two');
    await app.opp(2);
    await app.ft('Player Six', false, true);
    await app.opp(3);
    await app.opp(3);
    await app.expectStrip({ us: 28, opp: 28, period: 'Q4', fouls: 4, bonus: false, timeouts: { full: 2, thirty: 1 } });
    await app.expectPlayer('Player One', 2, 2);
    await app.expectPlayer('Player Two', 6, 2);

    await app.endPeriodThen('Q4', 'Start overtime');
    // OT bonus counting continues from Q4's 4.
    await app.expectStrip({ us: 28, opp: 28, period: 'OT1', fouls: 4, bonus: false, timeouts: { full: 2, thirty: 1, ot: 1 } });
    await expect(app.banner('Q4')).toBeVisible();

    // Later keeps a typed number as a draft, through a reload; a draft is not a check, so Q4
    // stays unchecked here and in both CSVs below.
    await app.banner('Q4').click();
    await app.ourPoints('Q4').fill('6');
    await app.later();
    await expect(app.banner('Q4')).toBeVisible();
    await page.reload();
    await app.banner('Q4').click();
    await expect(app.ourPoints('Q4')).toHaveValue('6');
    await app.later();
    await expect(app.banner('Q4')).toBeVisible();
    await expectNoOverflow(page);
  });

  await test.step('OT1: the 5th foul counting Q4 puts them in the bonus; an OT timeout; End game', async () => {
    await app.expectBarOneRow();
    await app.foul('Player Three');
    await app.expectEntryWhole(); // with the Check Q4 chip beside it
    await app.expectStrip({ us: 28, opp: 28, period: 'OT1', fouls: 5, bonus: true, timeouts: { full: 2, thirty: 1, ot: 1 } });
    await app.timeout('OT');
    await app.expectStrip({ us: 28, opp: 28, period: 'OT1', fouls: 5, bonus: true, timeouts: { full: 2, thirty: 1, ot: 0 } });
    await app.score('Player Three', '+2');
    await app.opp(1);
    await app.ft('Player One', true, true);
    await app.opp(2);
    await app.expectStrip({ us: 32, opp: 31, period: 'OT1', fouls: 5, bonus: true, timeouts: { full: 2, thirty: 1, ot: 0 } });
    await app.expectPlayer('Player Three', 9, 1);
    await app.expectPlayer('Player One', 4, 2);
    await app.expectPlayer('Player Four', 0, 5, true);
    await app.expectPlayer('Player Five', 2, 2, true);

    // The Log's period chips carry each quarter's check.
    await app.openLog();
    await expect(app.chip('Q1', 'matched')).toBeVisible();
    await expect(app.chip('Q2', 'fixed')).toBeVisible();
    await expect(app.chip('Q3', 'noted')).toBeVisible();
    await expect(app.chip('Q4', 'pending')).toBeVisible();
    await expectNoOverflow(page);
    await app.back();

    await app.endPeriodThen('OT1', 'End game (no more overtime)');
    await app.expectFinalScore(32, 31);
    await expect(app.issue('Q4', 'pending')).toBeVisible();
    await expect(app.issue('OT1', 'pending')).toBeVisible();
    await expect(app.issues()).not.toContainText('Q1');
    await expect(app.issues()).not.toContainText('Q2');
    await expect(app.issues()).not.toContainText('Q3');
    await expectNoOverflow(page);

    await app.reopen('OT1', 'pending');
    await app.fillCheck('OT1', 4, 3);
    await app.expectMatches();
    await app.saveCheck();
    await expect(app.issue('Q4', 'pending')).toBeVisible();
    await expect(app.issues()).not.toContainText('OT1');
    await app.expectFinalScore(32, 31);
  });

  await test.step('Book CSV', async () => {
    await app.expectExportState(false, false);
    const rows = await downloadCsv(page, app.exportButton('Book CSV'));
    await app.expectExportState(true, false);
    // Saving a file is not an edit: its entry (shown on Live) has no Undo.
    await app.backToLive();
    // The game has ended, so the strip reads Final and the End slot opens Final.
    await app.expectStrip({ us: 32, opp: 31, period: 'Final', fouls: 5, bonus: true, timeouts: { full: 2, thirty: 1, ot: 0 } });
    await app.expectBarOneRow('Final ▸');
    await app.expectToast('Exported Book CSV');
    await app.expectToastNoUndo('Q4');
    await app.openEnd();
    await app.expectExportState(true, false);
    const at = (first: string) => rows.findIndex((r) => r[0] === first);

    const score = at('Score by period');
    expect(rows[score + 1]).toEqual(['', 'Q1', 'Q2', 'Q3', 'Q4', 'OT1', 'Total']);
    expect(rows[score + 2]).toEqual([TEAM, '8', '9', '7', '6*', '4', '34*']);
    // Q4's opponent figure was never typed, so it is the tap total, starred like our estimates.
    expect(rows[score + 3]).toEqual([OPPONENT, '6', '4', '5', '13*', '3', '31*']);

    const header = rows[at('POS')];
    const col = (name: string) => header.indexOf(name);
    const line = (name: string) => rows.find((r) => r[1] === name)!;
    const stats = (r: string[]) => ({
      no: r[col('NO.')], fouls: r[col('FOULS')], techs: r[col('TECHS')],
      fg2: r[col("2'S")], fg3: r[col("3'S")], fta: r[col('FTA')], ftm: r[col('FTM')], tp: r[col('TP')],
    });
    const s = (no: string, fouls: string, techs: string, fg2: string, fg3: string, fta: string, ftm: string, tp: string) =>
      ({ no, fouls, techs, fg2, fg3, fta, ftm, tp });
    expect(stats(line('Player One'))).toEqual(s('#4', '2', '0', '1', '0', '2', '2', '4'));
    expect(stats(line('Player Two'))).toEqual(s('#00', '2', '0', '0', '1', '4', '3', '6'));
    expect(stats(line('Player Three'))).toEqual(s('#0', '1', '0', '3', '1', '0', '0', '9'));
    expect(stats(line('Player Four'))).toEqual(s('#12', '5', '0', '0', '0', '0', '0', '0'));
    expect(stats(line('Player Five'))).toEqual(s('#23', '2', '2', '1', '0', '0', '0', '2'));
    expect(stats(line('Player Six'))).toEqual(s('#31', '1', '0', '1', '1', '2', '1', '6'));
    expect(stats(line('Player Seven'))).toEqual(s('#44', '1', '0', '1', '1', '0', '0', '5'));
    const totals = rows[at('TEAM TOTALS')];
    expect([totals[col('FOULS')], totals[col('TECHS')], totals[col("2'S")], totals[col("3'S")],
      totals[col('FTA')], totals[col('FTM')], totals[col('TP')]]).toEqual(['14', '2', '7', '4', '8', '6', '32']);

    // Marks show where the edit, the added play and the move landed.
    const marks = (name: string) => ['Q1', 'Q2', 'Q3', 'Q4', 'OT1'].map((p) => line(name)[col(p)]);
    expect(marks('Player One')).toEqual(['2', '', '', '', 'FT FT']);
    expect(marks('Player Two')).toEqual(['FT 0', 'FT FT', '', '3', '']);
    expect(marks('Player Three')).toEqual(['3', '', '2', '2', '2']);
    expect(marks('Player Six')).toEqual(['', '3 2', '', '0 FT', '']);

    expect(rows.filter((r) => r[0] === 'Team fouls')).toEqual([
      ['Team fouls', 'Q1', '3'],
      ['Team fouls', 'Q2', '5'],
      ['Team fouls', 'Q3', '2'],
      ['Team fouls', 'Q4', '4'],
      ['Team fouls', 'OT1', '1'],
    ]);
    expect(rows[at('Bench technicals')]).toEqual(['Bench technicals', '1']);
    expect(rows.filter((r) => r[0] === 'Timeouts used')).toEqual([
      ['Timeouts used', 'Full', '1 of 3'],
      ['Timeouts used', '30', '1 of 2'],
      ['Timeouts used', 'OT', '1 of 1'],
    ]);

    const rec = at('Reconcile');
    expect(rows[rec + 1]).toEqual(['Period', 'Book', 'App', 'Diff', 'Status', 'Opp book', 'Opp taps', 'Note']);
    // Exactly five periods: no ghost OT2 row.
    expect(rows.slice(rec + 2)).toEqual([
      ['Q1', '8', '8', '0', 'matched', '6', '6', ''],
      ['Q2', '9', '9', '0', 'fixed', '4', '4', ''],
      ['Q3', '7', '5', '2', 'noted', '5', '5', Q3_NOTE],
      ['Q4', '', '6', '', 'pending', '', '13', ''],
      ['OT1', '4', '4', '0', 'matched', '3', '3', ''],
    ]);
  });

  await test.step('Plays CSV', async () => {
    const [header, ...plays] = await downloadCsv(page, app.exportButton('Plays CSV'));
    await app.expectExportState(true, true);
    const c = (name: string) => header.indexOf(name);
    expect(plays).toHaveLength(51);

    const perPeriod = (p: string) => plays.filter((r) => r[c('period')] === p).length;
    expect(['Q1', 'Q2', 'Q3', 'Q4', 'OT1'].map(perPeriod)).toEqual([12, 12, 7, 13, 7]);

    const last = plays[plays.length - 1];
    expect([last[c('us_score')], last[c('opp_score')]]).toEqual(['32', '31']);

    expect(plays.filter((r) => r[c('event')] === 'TIMEOUT').map((r) => [r[c('period')], r[c('detail')]])).toEqual([
      ['Q1', 'full'],
      ['Q3', 'thirty'],
      ['OT1', 'ot'],
    ]);

    // The edit: one row, now #0 in Q3.
    const edited = plays.filter((r) => r[c('edited')] === 'yes');
    expect(edited.map((r) => [r[c('period')], r[c('number')], r[c('event')]])).toEqual([['Q3', '0', 'FG2']]);

    // The missed play, added from the check, is the last Q2 row.
    const q2 = plays.filter((r) => r[c('period')] === 'Q2').map((r) => `${r[c('number')]} ${r[c('event')]}`);
    expect(q2[q2.length - 1]).toBe('31 FG2');

    // The move: the first two Q4 rows are the plays entered before End Q3.
    const q4 = plays.filter((r) => r[c('period')] === 'Q4').map((r) => `${r[c('team')]} ${r[c('number')]} ${r[c('event')]}`);
    expect(q4.slice(0, 2)).toEqual(['us 0 FG2', 'opp  OPP_PTS']);
  });
});
