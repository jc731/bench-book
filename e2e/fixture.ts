import { expect, type Locator, type Page } from '@playwright/test';

/*
 * The full-game fixture: the invented roster and every piece of UI wording the scripted game
 * uses. `e2e/full-game.spec.ts` plays the game and `scripts/howto/shots.spec.ts` takes the
 * How-to screenshots with it. Like the spec, it imports nothing from src/.
 */

export const ROSTER = [
  { name: 'Player One', number: '4' },
  { name: 'Player Two', number: '00' },
  { name: 'Player Three', number: '0' },
  { name: 'Player Four', number: '12' },
  { name: 'Player Five', number: '23' },
  { name: 'Player Six', number: '31' },
  { name: 'Player Seven', number: '44' },
] as const;
export type Name = (typeof ROSTER)[number]['name'];
export const TEAM = 'Test Home';
export const OPPONENT = 'Test Opp';
const numberOf = (name: Name) => ROSTER.find((p) => p.name === name)!.number;

/** Check statuses as the Log chips and the open-issues list show them. */
export const STATUS = { matched: '✓ Matched', fixed: '✓ Fixed', noted: 'Noted', pending: 'Not checked' } as const;
export type Status = keyof typeof STATUS;

// ---- UI wording lives only in this block --------------------------------------------------

/** Timeouts left; `ot` only in an OT period (one OT timeout per OT period, so OT1 has 1). */
interface TimeoutsLeft { full: number; thirty: number; ot?: number }
export const timeoutsText = (t: TimeoutsLeft) =>
  `TO left: ${[`Full ${t.full}`, `30s ${t.thirty}`, ...(t.ot === undefined ? [] : [`OT ${t.ot}`])].join(' · ')}`;

export function ui(page: Page) {
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
      await page.getByText('Game details', { exact: true }).click();
      await page.getByLabel('Our team (optional)').fill(team);
      await page.getByLabel('Also keep their score (Opp +1/+2/+3)').check();
      for (let i = 0; i < ROSTER.length; i++) {
        if (i > 0) await page.getByRole('button', exact('Add player')).click();
        const n = i + 1;
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
     *  The End slot reads `End Qn` while the game is live, or the given name (`Final` once it has ended; its ▸ is hidden from screen readers). */
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
    /** ⋯ > How to use: an in-app page, so the game and Undo stay. */
    async openHowto() {
      await nav().getByRole('button', exact('More')).click();
      await dialog().getByRole('button', exact('How to use')).click();
      await expect(page.getByRole('heading', exact('How to use'))).toBeVisible();
    },
    async closeHowto() {
      await page.getByRole('button', exact('Back')).click();
      await expect(page.getByRole('heading', exact('How to use'))).toHaveCount(0);
    },
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
      const also = dialog().getByRole('checkbox', exact(`Also move the ${after} play${after === 1 ? '' : 's'} after it in ${fromLabel}`));
      // In view as soon as the quarter is picked (.check() would scroll to it, hiding a below-the-fold box).
      await expect(also).toBeInViewport({ ratio: 1 });
      await also.check();
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

export async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
}

/** Two lines plus padding: score line (text-3xl) and the timeouts line. A wrap adds 20px or more. */
const STRIP_MAX_HEIGHT = 80; // measured 77 at 390px, with the bonus pill in OT1
