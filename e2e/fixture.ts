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
/** The timeout buttons under a team's Bench card, as they read: `Full: 2`, `30s: 1`, `OT: 1`. */
export const timeoutButtons = (t: TimeoutsLeft) =>
  [`Full: ${t.full}`, `30s: ${t.thirty}`, ...(t.ot === undefined ? [] : [`OT: ${t.ot}`])];
const TIMEOUT_KIND = { Full: 'Full', '30s': '30s', OT: 'OT' } as const;

export type Side = 'Home' | 'Away';
const other = (s: Side): Side => (s === 'Home' ? 'Away' : 'Home');
const BENCH = /^Bench \/ coach tech(, \d+ techs?)?$/;

/** `ours` is the half our team is on: Home on a home game (every scripted game is one). */
export function ui(page: Page, ours: Side = 'Home') {
  const dialog = () => page.getByRole('dialog');
  const strip = () => page.getByRole('banner');
  const nav = () => page.getByRole('navigation');
  const exact = (name: string) => ({ name, exact: true });
  /** One team's half of the live screen: its cards, + Play, Bench card and timeout buttons. */
  const half = (side: Side) => page.getByRole('region', exact(side));

  const card = (name: Name) => half(ours).getByRole('button', { name: new RegExp(`^#${numberOf(name)} ${name},`) });
  /** A fixture name's number, or the string itself when it is already a number. */
  const numOrName = (who: string) => ROSTER.find((p) => p.name === who)?.number ?? who;
  /** A player's row in the sub sheet, by name or number. */
  const subRow = (who: string) => dialog().getByRole('button', { name: new RegExp(`^#${numOrName(who)}(,| |$)`) });

  /** Taps a player, then each play button. FT buttons keep the sheet open for the pair, so close it with Done. */
  async function onPlayer(name: Name, plays: string[], closeWithDone: boolean) {
    await card(name).click();
    for (const p of plays) await dialog().getByRole('button', exact(p)).click();
    if (closeWithDone) await dialog().getByRole('button', exact('Done')).click();
    await expect(dialog()).toHaveCount(0);
  }

  return {
    /** Setup: opponent, our team, and the whole roster. */
    async fillSetup(opponent: string, team: string) {
      await page.getByText('Game details', { exact: true }).click();
      await page.getByLabel('Opponent (optional)').fill(opponent);
      await page.getByLabel('Our team (optional)').fill(team);
      for (let i = 0; i < ROSTER.length; i++) {
        if (i > 0) await page.getByRole('button', exact('Add player')).click();
        const n = i + 1;
        await page.getByLabel(`Player ${n} name`, { exact: true }).fill(ROSTER[i].name);
        await page.getByLabel(`Player ${n} number`, { exact: true }).fill(ROSTER[i].number);
      }
    },
    /** The other team's roster, in Setup's "Their roster (optional)" section. */
    async fillOppRoster(players: { number: string; name?: string }[]) {
      for (let i = 0; i < players.length; i++) {
        if (i > 0) await page.getByRole('button', exact('Add their player')).click();
        const n = i + 1;
        await page.getByLabel(`Their player ${n} number`, { exact: true }).fill(players[i].number);
        if (players[i].name) await page.getByLabel(`Their player ${n} name`, { exact: true }).fill(players[i].name!);
      }
    },
    startGame: () => page.getByRole('button', exact('Start game')).click(),
    card,
    score: (name: Name, pts: '+2' | '+3') => onPlayer(name, [pts], false),
    ft: (name: Name, ...made: boolean[]) => onPlayer(name, made.map((m) => (m ? 'FT made' : 'FT missed')), true),
    foul: (name: Name) => onPlayer(name, ['Foul'], false),
    tech: (name: Name) => onPlayer(name, ['Tech foul'], false),
    half,
    /** A half's Sub button, beside + Play; it reads `Starters` or `Sub`. Absent with five players or fewer. */
    subButton: (side: Side) => half(side).getByRole('button', { name: /^(Starters|Sub)$/ }),
    /**
     * A deliberate sub from the play sheet, 3 taps: the in player's card, their `#N checks in` row, then
     * the out player in "Who went out?". Players are fixture names or bare numbers (`'55'`).
     */
    async subIn(side: Side, inName: string, outName: string) {
      const n = numOrName(inName);
      await half(side).getByRole('button', { name: new RegExp(`^#${n}(,| )`) }).click();
      await dialog().getByRole('button', exact(`#${n} checks in`)).click();
      await expect(dialog()).toHaveAccessibleName('Who went out?');
      await subRow(outName).click();
      await expect(dialog()).toHaveCount(0);
    },
    /** The team's Sub (or Starters) button, then "Who's on the floor?" toggled to exactly `names`, then Done. */
    async setFloor(side: Side, names: string[]) {
      await half(side).getByRole('button', { name: /^(Starters|Sub)$/ }).click();
      await expect(dialog()).toHaveAccessibleName("Who's on the floor?");
      const want = names.map(numOrName);
      const rows = await dialog().getByRole('button', { name: /^#/ }).evaluateAll((els) =>
        els.map((el) => ({ n: /^#([^\s,]+)/.exec(el.getAttribute('aria-label')!)![1], on: el.getAttribute('aria-pressed') === 'true' })));
      for (const { n, on } of rows) if (on !== want.includes(n)) await subRow(n).click();
      await dialog().getByRole('button', exact('Done')).click();
      await expect(dialog()).toHaveCount(0);
    },
    /** The numbers on a half's floor cards, in display order: every card whose name doesn't end `, bench` or `, out`. */
    floorOf: (side: Side) =>
      half(side).getByRole('button', { name: /^#/ }).evaluateAll((els) =>
        els
          .map((el) => el.getAttribute('aria-label') ?? '')
          .filter((name) => !/, (bench|out)$/.test(name))
          .map((name) => /^#([^\s,]+)/.exec(name)![1])),
    /** Points for the other team with no number, through their + Play and Whose number? > No number: 1 is an FT made (then Done), 2 a +2, 3 a +3. */
    async opp(n: 1 | 2 | 3) {
      await half(other(ours)).getByRole('button', exact('+ Play')).click();
      await expect(dialog()).toHaveAccessibleName(other(ours));
      await dialog().getByRole('button', exact(n === 1 ? 'FT made' : `+${n}`)).click();
      await expect(dialog()).toHaveAccessibleName('Whose number?');
      await dialog().getByRole('button', exact('No number')).click();
      if (n === 1) await dialog().getByRole('button', exact('Done')).click();
      await expect(dialog()).toHaveCount(0);
    },
    /** A half's Bench card, then its one button. */
    async benchTech(side: Side = ours) {
      await half(side).getByRole('button', { name: BENCH }).click();
      await dialog().getByRole('button', exact('Bench tech')).click();
      await expect(dialog()).toHaveCount(0);
    },
    /** The bottom bar: Undo, Log, the End slot and More, all on one line and at most 48px tall.
     *  The End slot reads `End Qn` while the game is live, or the given name (`Final` once it has ended; its ▸ is hidden from screen readers). */
    async expectBarOneRow(endSlot?: string) {
      const end = endSlot === undefined ? { name: /^End (Q|OT)\d/ } : exact(endSlot);
      const names = [{ name: /^Undo/ }, exact('Log'), end, exact('More')];
      const boxes = [];
      for (const n of names) boxes.push((await nav().getByRole('button', n).boundingBox())!);
      expect(new Set(boxes.map((b) => b.y)).size).toBe(1);
      for (const b of boxes) expect(b.height).toBeLessThanOrEqual(48);
      expect(await nav().getByRole('button').count()).toBe(4);
    },
    /** Each half shows all of its cards, + Play, Bench and timeouts with no scrolling, above the feedback line. */
    async expectCardsFit() {
      const line = (await page.getByTestId('feedback-text').boundingBox())!;
      for (const side of ['Home', 'Away'] as const) {
        expect(await half(side).evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
        const box = (await half(side).boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(line.y);
      }
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
    /** An out player's sheet: the warning shows and every play is grayed out. Closes with Done. */
    async expectOutGuard(name: Name, reason: string) {
      // The card's OUT label is drawn at full strength: graying the whole card once took it to 2.2:1.
      const out = card(name).getByText('OUT', { exact: true });
      expect(await out.evaluate((el) => {
        let o = 1;
        for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
        return o;
      })).toBe(1);
      await card(name).click();
      await expect(dialog().getByTestId('out-warning')).toContainText(`Out: ${reason}. Are you sure? This player is supposed to be out.`);
      for (const p of ['+2', '+3', 'FT made', 'FT missed', 'Foul', 'Tech foul']) {
        await expect(dialog().getByRole('button', exact(p))).toBeDisabled();
      }
      await dialog().getByRole('button', exact('Done')).click();
      await expect(dialog()).toHaveCount(0);
    },
    /** Past the out warning on purpose, then one play. */
    async anyway(name: Name, play: '+2' | '+3') {
      await card(name).click();
      await dialog().getByRole('button', exact('Enter a play anyway')).click();
      await dialog().getByRole('button', exact(play)).click();
      await expect(dialog()).toHaveCount(0);
    },
    /** The Bench card's count, as screen readers hear it. */
    expectBenchTechs: (n: number) =>
      expect(half(ours).getByRole('button', { name: /^Bench \/ coach tech/ })).toHaveAccessibleName(n === 0 ? 'Bench / coach tech' : `Bench / coach tech, ${n} tech${n === 1 ? '' : 's'}`),
    /** Setup with the opponent left blank (it defaults to the game date as MM-DD). */
    async fillSetupNoOpponent(team: string) {
      await page.getByText('Game details', { exact: true }).click();
      await page.getByLabel('Our team (optional)').fill(team);
      for (let i = 0; i < ROSTER.length; i++) {
        if (i > 0) await page.getByRole('button', exact('Add player')).click();
        await page.getByLabel(`Player ${i + 1} name`, { exact: true }).fill(ROSTER[i].name);
        await page.getByLabel(`Player ${i + 1} number`, { exact: true }).fill(ROSTER[i].number);
      }
    },
    /** The Date field's value as MM-DD: the opponent a blank Opponent field becomes. */
    defaultOpponent: async () => (await page.getByLabel('Date').inputValue()).slice(5),
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
    /** One tap on a team's timeout button (`Full: 2`), under its Bench card. */
    async timeout(kind: 'Full' | '30s' | 'OT', side: Side = ours) {
      await half(side).getByRole('button', { name: new RegExp(`^${TIMEOUT_KIND[kind]}: \\d+$`) }).click();
      await expect(dialog()).toHaveCount(0);
    },
    /** End Q1–Q3 directly. */
    endPeriod: (label: string) => nav().getByRole('button', exact(`End ${label}`)).click(),
    /** End Q4 or an OT: the button opens a sheet offering Start overtime / End game (no overtime). */
    async endPeriodThen(label: string, choice: 'Start overtime' | 'End game (no overtime)' | 'End game (no more overtime)') {
      const end = nav().getByRole('button', exact(`End ${label}`));
      // The label sits on one line: wrapped to "End / Q4…" it read as cut off (UX audit v0.6.0, F1).
      expect(await end.evaluate((el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return new Set(Array.from(r.getClientRects(), (b) => Math.round(b.top))).size;
      })).toBe(1);
      // ...and inside the button, not spilling past its edges.
      expect(await end.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await end.click();
      await dialog().getByRole('button', exact(choice)).click();
    },
    /** The check chip on the feedback line, by its full accessible name. */
    banner: (label: string) => page.getByRole('button', exact(`Check ${label} — not checked against the book`)),
    /** On the Check view: type the book's running score after the quarter (and a note); the comparison updates as you type. */
    async fillCheck(label: string, us: number, opp: number, note?: string) {
      await page.getByLabel(new RegExp(`Our game score after ${label}`)).fill(String(us));
      await page.getByLabel(new RegExp(`Their game score after ${label}`)).fill(String(opp));
      if (note !== undefined) await page.getByLabel('Note', { exact: true }).fill(note);
      // Leaving a field saves nothing: only Save does. Every field above was left at least once
      // (each fill blurs the one before, and this focus blurs the last). A blur-save would turn
      // the store-driven status chip from "Not checked" at once, so wait two frames for any such
      // render, then the chip must still say unchecked.
      await page.getByLabel(new RegExp(`Our game score after ${label}`)).focus();
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      expect(await page.getByTestId('check-status').textContent()).toBe(STATUS.pending);
    },
    /** The check's top line: the app's game score after the quarter, then the quarter's own points. */
    expectAppHas: (label: string, us: number, them: number, gameUs: number, gameThem: number) =>
      expect(page.getByTestId('app-has')).toHaveText(`App after ${label}: Us ${gameUs} · Them ${gameThem} (${label}: ${us}–${them})`),
    expectMismatchHint: () =>
      expect(page.getByTestId('compare-hint')).toHaveText('Add the missing play, fix one below, or write a note and Save.'),
    expectMatches: (text = '✓ Matches') => expect(page.getByTestId('compare')).toHaveText(text),
    /** Totals as typed and as the app has them; the gap is graded within the quarter. */
    expectShort: (label: string, bookTotal: number, appTotal: number, gap: number) =>
      expect(page.getByTestId('compare')).toHaveText(`Book ${bookTotal} · App ${appTotal} — app is ${gap} short in ${label}`),
    saveCheck: () => page.getByRole('button', exact('Save')).click(),
    later: () => page.getByRole('button', exact('Later')).click(),
    ourPoints: (label: string) => page.getByLabel(new RegExp(`Our game score after ${label}`)),
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
    playText: (name: Name, play: '+2' | '+3') => `#${numberOf(name)} ${name} (Home) · ${play}`,
    /** A Log row for the other team's no-number play from opp(n): the team name, then the play. */
    oppText: (n: 1 | 2 | 3) => `${other(ours)} · ${n === 1 ? 'FT made' : `+${n}`}`,
    /** The Log row starting with `text` (an "edited" tag may follow it). */
    logRow: (scope: Locator, text: string) =>
      scope.getByRole('button', { name: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }),
    /** From the check's "Plays to fix": adds a play at the end of that quarter. */
    async addPlay(label: string, name: Name, pts: '+2' | '+3') {
      await this.fixRegion().getByRole('button', exact(`Add play to ${label}`)).click();
      await dialog().getByRole('button', exact(`#${numberOf(name)} ${name}`)).click();
      await dialog().getByRole('button', exact(pts)).click();
      await expect(dialog()).toHaveCount(0);
      await this.expectToast(`Added #${numberOf(name)} (Home) ${pts} to ${label}`);
    },
    /** From the check's "Plays to fix": adds the other team's play (by number, or `No number`) at the end of that quarter. */
    async addTheirPlay(label: string, who: string, play: '+2' | '+3' | 'Foul') {
      await this.fixRegion().getByRole('button', exact(`Add play to ${label}`)).click();
      await dialog().getByRole('group', exact('Team')).getByRole('button', exact(other(ours))).click();
      await dialog().getByRole('button', who === 'No number' ? exact(who) : { name: new RegExp(`^#${who}( |$)`) }).click();
      await dialog().getByRole('button', exact(play)).click();
      await expect(dialog()).toHaveCount(0);
      await this.expectToast(`Added ${who === 'No number' ? other(ours) : `#${who} (${other(ours)})`} ${play} to ${label}`);
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
      Promise.all([
        expect(page.getByTestId('final-us')).toHaveText(`${TEAM} ${us}`),
        expect(page.getByTestId('final-them')).toHaveText(`${OPPONENT} ${opp}`),
      ]),
    exportButton: (which: 'Book CSV' | 'Plays CSV') => page.getByRole('button', exact(which)),
    /** Each file's saved state on the Final screen. */
    async expectExportState(book: boolean, plays: boolean) {
      await expect(page.getByTestId('export-state-book')).toHaveText(book ? 'Book CSV ✓ saved' : 'Book CSV — not saved yet');
      await expect(page.getByTestId('export-state-plays')).toHaveText(plays ? 'Plays CSV ✓ saved' : 'Plays CSV — not saved yet');
    },
    /** The opponent box starts blank, with the tap total only as a hint. */
    expectOppHint: (label: string, taps: number) =>
      expect(page.getByLabel(new RegExp(`Their game score after ${label}`))).toHaveAttribute('placeholder', `${taps} from the app`),

    /** The strip (score home–away, period, the bonus badge) and our half's header and timeout buttons. */
    async expectStrip(s: { us: number; opp: number; period: string; fouls: number; bonus: boolean; timeouts: TimeoutsLeft }) {
      const h = strip();
      // Nothing on the strip may wrap at 390px: it is one line high in every state.
      const box = await h.boundingBox();
      expect(box!.height).toBeLessThanOrEqual(STRIP_MAX_HEIGHT);
      const [home, away] = ours === 'Home' ? [s.us, s.opp] : [s.opp, s.us];
      await expect(h.getByLabel(`Score Home ${home}, Away ${away}`)).toBeVisible();
      await expect(h.getByText(s.period, { exact: true })).toBeVisible();
      await expect(half(ours).getByText(`Team fouls ${s.fouls}`, { exact: true })).toBeVisible();
      await expect(h.getByText(`${other(ours)} shoots`, { exact: true })).toHaveCount(s.bonus ? 1 : 0);
      for (const t of timeoutButtons(s.timeouts)) await expect(half(ours).getByRole('button', exact(t))).toBeVisible();
      if (s.timeouts.ot === undefined) await expect(half(ours).getByRole('button', { name: /^OT: / })).toHaveCount(0);
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
    /** The 4-foul warning, which shows only as the card's amber border (amber-600 on the light Home half, amber-400 on the dark Away half). */
    expectWarning: (name: Name) => expect(card(name)).toHaveClass(ours === 'Home' ? /border-amber-600/ : /border-amber-400/),
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

/** One line plus padding: the score (text-3xl), the period and the bonus badges. A wrap adds 20px or more. */
const STRIP_MAX_HEIGHT = 56;

/**
 * WCAG contrast ratio of one of an element's colors against the nearest opaque background, read
 * through a canvas because Tailwind 4 emits `oklch()`. `prop` is the color measured; `from` is where
 * the background search starts: the element itself (its text or border sits on its own fill) or its
 * parent (a dot's own fill is the color measured, so the card behind it is the background).
 */
export function colorContrast(
  l: Locator,
  prop: 'color' | 'borderTopColor' | 'backgroundColor' = 'color',
  from: 'self' | 'parent' = 'self',
): Promise<number> {
  return l.evaluate(
    (el, [p, f]) => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      const rgba = (css: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return { r, g, b, a };
      };
      const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
        const c = [r, g, b].map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const fg = rgba((getComputedStyle(el) as unknown as Record<string, string>)[p]);
      let node: Element | null = f === 'parent' ? el.parentElement : el;
      let bg = { r: 255, g: 255, b: 255, a: 255 };
      for (; node; node = node.parentElement) {
        const c = rgba(getComputedStyle(node).backgroundColor);
        if (c.a === 255) { bg = c; break; }
      }
      const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    },
    [prop, from] as const,
  );
}

/** The WCAG ratio of an element's text color against its nearest opaque background. */
export const contrast = (l: Locator) => colorContrast(l, 'color');
