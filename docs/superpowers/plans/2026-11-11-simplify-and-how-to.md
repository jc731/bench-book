# Simplify the UI and move help to a How-to page: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the game screens to what a scorer needs, keep every ref's call and book entry
recordable at no extra cost to a veteran, and put all explanation on one offline How-to page
whose screenshots a script refreshes on every release.

**Architecture:** Each screen change lands with its pure logic in the `*-logic.ts` module next
to it (unit-tested), the component wired to it, and the two e2e specs updated in the same task,
so `pnpm test:e2e` is green after every task. The How-to page is a new in-app `View` like Log,
its text is data in `src/ui/howto-content.ts`, and its PNGs come from a Playwright script that
reuses the full-game fixture. `pnpm release` runs that script as an injected step.

**Tech Stack:** Astro 7 (static), Preact 11, Tailwind 4, Vitest 5, Playwright 1.65,
`@vite-pwa/astro` (Workbox `generateSW`).

**Spec:** `docs/superpowers/specs/2026-11-11-simplify-and-how-to-design.md`. Read it in full
before any task, especially "Owner rulings", which override Decisions 6 and 24 where they
conflict. Also read the repo `CLAUDE.md`.

## Global Constraints

- One app for everyone: no tips, coach marks, first-run hints, practice game or newbie mode
  anywhere. The only help is the How-to page.
- Every ref's call stays recordable: Foul, Tech foul, Bench tech, each timeout kind (Full, 30,
  OT), FT made, FT missed, +2, +3.
- Tap budget for an experienced scorer must not rise: basket or foul **2**, opponent points
  **1**, timeout **2**, free-throw pair **4**, end of quarter plus check **4**.
- All 7 player cards plus the Bench card fit on a **390×664** viewport (Playwright `iPhone 13`)
  with opponent taps on, with no scrolling of the grid.
- Tap targets at least 44px (`min-h-11`); nothing on the page scrolls sideways at 390px.
- `e2e/full-game.spec.ts`: update its helper block for every UI change, never its expected
  numbers (scores, fouls, timeouts, CSV values, row counts). UI wording lives only in its helper
  block; it imports nothing from `src/`.
- Keep `insertEventBefore`, `Player.pos` and `GameEvent.order` and their tests. Remove a
  UI-only helper (`insertLabel` and similar) once its last caller is gone, with its tests.
- How-to images are **PNG** in `public/howto/` (the precache glob in `astro.config.mjs` is
  `**/*.{js,css,html,svg,png,ico,webmanifest}`: png yes, webp/jpg no).
- Test data uses invented names only (`Player One`, `Test Opp`). US English everywhere.
- Each task ends with `pnpm check` green, and `pnpm test:e2e` green when it touched the UI or
  `e2e/`. Commit per task to `master`, no attribution trailer, no push.
- Each task adds its bullets under `## [Unreleased]` in `CHANGELOG.md`, `- ` bullets only.

## Rulings on spec ambiguities

The plan decided these; each task below follows them.

1. **Undo on the Live feedback line.** Decision 3 shows "#12 +2 — bonus [Undo]" but also says
   the bar keeps Undo and "there are never two Undos in view". Ruling: on **Live** the line has
   **no Undo button of its own**; the bar's Undo is the line's Undo. While the line shows an
   undoable entry, the bar Undo carries `aria-describedby` pointing at the line's text, so it is
   announced as undoing that entry. Log and the quarter check have no bar, so their lines keep
   their own Undo (Decision 4).
2. **The "Undo button's second line"** ("Left to the builder") refers to the minimalist idea the
   critique rejected. The bar Undo has one line, "Undo".
3. **How-to section 5** says bench techs are "under Timeout"; Decision 2 moved them to a Bench
   card for stated reasons. Decision 2 wins; section 5 says bench techs are on the Bench card.
4. **Ending a game.** Owner ruling 1 overrides Decisions 6 and 24: the Final screen shows
   "End game early" (with a confirm) while the game is live, and "Reopen game" once it has ended.
   ⋯ → "Final / export" still never ends the game. The Final title is "Final" in both states;
   the only difference is that button.
5. **Final keeps no header Back.** Decision 24 names the footer "Back to game" and "New game";
   a second Back in the header would duplicate it.
6. **Resume text** follows the spec literal, short form: `Last: #12 +2` (not the 0.2.0
   `Resumed · last: #12 Player Four +2`).
7. **The feedback line no longer fades** on Live, Log or the check ("stays put"). A player sheet
   or the check's Add-play sheet shows only feedback produced while it is open, so a stale entry
   from another player never appears in it.
8. **Moving a play with the ones after it** works for any quarter in the Quarter group, not
   only adjacent ones (`moveFrom` is already general). The checkbox shows only when the picked
   quarter differs and at least one play follows in the original quarter.
9. **Hand-replaced How-to images** take a new filename, referenced from `howto-content.ts`. The
   script writes only its own three filenames, so a release never overwrites a hand-made image.
10. **Plays CSV order assertion.** Cutting insert-before (Decision 15) moves the missed Q2 play
    to the end of Q2. The full-game assertion "the insert sits right before #44's +2" becomes
    "the added play is the last Q2 row". That is an order fact, not an expected number; every
    count, score, mark and total stays as written.
11. **The persona swarm brief** for the final task is not in the repo (only
    `docs/ux-audit/personas/bookkeeper.md` and `docs/ux-audit/scenario.md` are). The controller
    supplies it from the 2026-11-11 session.

## Review Focus

1. **Bar labels at 390px.** With five columns (~68px each), `End OT1…`, `End OT2…` and
   `Final ▸` must stay on one line and not truncate. Pinned by `expectBarOneRow` in Task 2,
   called in Q1, OT1 and after End game (Task 3).
2. **Stale feedback inside a sheet.** Opening a second player's sheet must not show the first
   player's entry with an Undo. Pinned by the Q1 step in Task 1.
3. **Edit that changes player and quarter at once, with "Also move".** One save, one undo step,
   the right plays moved. Pinned by `editSave` unit tests in Task 4.
4. **Reopen after a reload.** An ended game reloaded, then reopened, must show the period again
   (not "Final"), the End Qn slot, and no not-exported warning. Pinned in `e2e/game.spec.ts`,
   Task 3.
5. **Clear saved roster, then Cancel.** The roster must survive. Pinned in `e2e/game.spec.ts`,
   Task 6.

---

### Task 1: One fixed feedback line on Live, Log and the check

Decisions 3, 4. Rulings 1, 2, 6, 7.

**Files:**
- Modify: `src/ui/live-logic.ts`, `src/ui/live-logic.test.ts`
- Modify: `src/ui/log-logic.ts`, `src/ui/log-logic.test.ts` (`resumeText`)
- Modify: `src/ui/store.ts` (move `Toast` type out, drop `clearToast`)
- Modify: `src/ui/Live.tsx`, `src/ui/Log.tsx`, `src/ui/Reconcile.tsx`, `src/ui/EventSheet.tsx`
- Modify: `e2e/full-game.spec.ts` (helper block), `e2e/game.spec.ts`

**Interfaces:**
- Produces, in `live-logic.ts`:
  - `export type Toast = { text: string; canUndo: boolean }` (moved from `store.ts`;
    `store.ts` re-exports it).
  - `export type Feedback = { kind: 'prompt'; text: string; period: number } | { kind: 'export'; text: string } | { kind: 'entry'; text: string; undoable: boolean } | { kind: 'empty' }`
  - `export function feedbackLine(banner: Banner | null, unexported: string | null, toast: Toast | null): Feedback`
    — priority: banner, then unexported, then toast, else empty.
- Produces, in `log-logic.ts`: `resumeText(g)` now returns `Last: ${eventLabel(g, last)}`.
- Produces in the DOM (used by every later task's e2e): the Live line is one element with
  `role="status"`, its text in a span with `id="feedback-text"` and `data-testid="feedback-text"`.
  Log and Reconcile lines use the same `data-testid`.

- [ ] **Step 1: Write the failing tests** in `live-logic.test.ts`:

```ts
describe('feedbackLine', () => {
  const banner = { period: 1, text: 'Q1 not checked against the book — Check' };
  const toast = { text: '#12 +2 — bonus', canUndo: true };
  it('puts the check prompt first', () =>
    expect(feedbackLine(banner, 'Not exported — game data clears in 72 h', toast)).toEqual({ kind: 'prompt', ...banner }));
  it('puts the export warning before the last entry', () =>
    expect(feedbackLine(null, 'Not exported — game data clears in 72 h', toast))
      .toEqual({ kind: 'export', text: 'Not exported — game data clears in 72 h' }));
  it('shows the last entry and whether it can be undone', () => {
    expect(feedbackLine(null, null, toast)).toEqual({ kind: 'entry', text: '#12 +2 — bonus', undoable: true });
    expect(feedbackLine(null, null, { text: 'Undid #12 +2', canUndo: false })).toEqual({ kind: 'entry', text: 'Undid #12 +2', undoable: false });
  });
  it('is empty with nothing to say', () => expect(feedbackLine(null, null, null)).toEqual({ kind: 'empty' }));
});
```

  and change the `resumeText` expectations in `log-logic.test.ts` to `'Last: #4 +2'` and
  `'Last: Opp +3'` (null cases unchanged).

- [ ] **Step 2:** Run `pnpm vitest run src/ui/live-logic.test.ts src/ui/log-logic.test.ts`.
  Expected: FAIL (`feedbackLine` not exported; resume text differs).

- [ ] **Step 3: Implement** `feedbackLine` and the new `resumeText`; move `Toast`.

- [ ] **Step 4: Wire the components.**
  - `Live.tsx`: delete the `h-11` band under the strip and the absolutely positioned toast.
    Render one full-width `min-h-11` line directly above `<nav>` from `feedbackLine(...)`:
    `prompt` is an amber button opening `openReconcile(period, 'live')`; `export` is an amber
    button opening Final; `entry` is plain text; `empty` keeps the row's height. The bar Undo
    gets `aria-describedby="feedback-text"` only when the line is `entry` with `undoable`.
    Remove `TOAST_MS` and its effect. Keep the "Game ended" bar for now (Task 3 cuts it) by
    rendering it in place of `empty` when `game.endedAt`.
  - `Log.tsx`, `Reconcile.tsx`: remove the fade effect and `TOAST_MS`; keep their own line with
    Undo, add `data-testid="feedback-text"` to its text span.
  - `EventSheet` callers (Live's player sheet, Reconcile's Add-play sheet): hold the toast
    present when the sheet opened in a ref and pass `toast === openedWith ? null : toast`.
  - `store.ts`: drop `clearToast` (no callers left).

- [ ] **Step 5: Update e2e.** In the full-game helper block:
  - `expectToast(text)` → `expect(page.getByTestId('feedback-text')).toHaveText(text)`.
  - `expectToastUndo()` → the nav Undo `toHaveAccessibleDescription` equal to the line's text,
    asserted together with `expectToast`.
  - `expectToastNoUndo()` → after the Book CSV export and Back, the line reads
    `Not exported — game data clears in 72 h` (it outranks the export entry) and the nav Undo
    has accessible description `''`.
  - Add to the Q1 step, right after `app.score('Player One', '+2')`: open Player Three's card,
    expect the sheet's status text to be empty and no Undo in the dialog, close with Done.

  In `game.spec.ts`: the reload assertion becomes
  `expect(page.getByTestId('feedback-text')).toHaveText('Last: #0 +3')`.

- [ ] **Step 6:** Run `pnpm check && pnpm test:e2e`. Expected: all green.

- [ ] **Step 7: Changelog and commit.** Add under `## [Unreleased]`:
  - `- One line above the bottom bar shows what just happened, for example "#12 +2 — bonus", and stays until the next entry instead of fading. Check prompts and the not-exported warning use the same line and come first. Undo is on the bottom bar.`
  - `- After a reload the line reads "Last: #12 +2".`
  - `- A player's sheet shows only what was entered while it is open.`

```bash
git add -A src e2e CHANGELOG.md && git commit -m "Live: one fixed feedback line instead of a fading toast"
```

---

### Task 2: One-row bottom bar and a Bench card

Decisions 1, 2, 9.

**Files:**
- Modify: `src/ui/Live.tsx`, `src/ui/PlayerGrid.tsx`, `src/ui/EventSheet.tsx` (only if Done
  needs restyling)
- Modify: `e2e/full-game.spec.ts`, `e2e/game.spec.ts`

**Interfaces:**
- Produces: `PlayerGrid` gains prop `onBench: () => void` and renders a last card whose
  accessible name is exactly `Bench`. Its sheet is a `Sheet` titled `Bench` with one button,
  `Bench tech` (`BENCH_TECH_TEXT`), which records the entry and closes the sheet.
- Produces: the grid's scroll container carries `data-testid="player-grid"`.
- Produces, in the e2e helper block: `expectBarOneRow()` and `expectCardsFit()` (below).

- [ ] **Step 1: Write the failing e2e helpers and calls** in the full-game helper block:
  - `benchTech()` → click the `Bench` card, then the dialog's `Bench tech`, expect no dialog.
  - `expectBarOneRow()` → the nav's last row holds exactly the buttons `Timeout`, `Undo`, `Log`,
    the End slot and `More`; all share one `boundingBox().y`, and each height is ≤ 48.
  - `expectCardsFit()` → on `player-grid`, `scrollHeight <= clientHeight`, and the `Bench`
    card's bottom is above the feedback line's top.
  - Call `expectCardsFit()` and `expectBarOneRow()` right after `startGame()` (taps are on, so
    the Opp row shows) and `expectBarOneRow()` again on OT1 before `End OT1…`.
  - Add to Q1, before the mis-tap: open Player One's card, click the backdrop at
    `{ position: { x: 10, y: 10 } }` of the page, expect no dialog and the strip unchanged
    (6–2). Also assert the sheet's `Done` has the primary class `bg-white`.

- [ ] **Step 2:** Run `pnpm test:e2e`. Expected: FAIL (no `Bench` card; bar has three rows).

- [ ] **Step 3: Implement.** In `Live.tsx` the nav becomes: the Opp +1/+2/+3 row (only with
  taps on), then one `grid-cols-5` row `Timeout · Undo · Log · End Qn · ⋯`. Bench tech leaves
  the bar. Add the `Bench` card and sheet. The grid container's bottom padding shrinks to what
  the one-row bar needs. Done stays the white primary button.

- [ ] **Step 4:** Run `pnpm check && pnpm test:e2e`. Expected: green, all expected numbers
  unchanged (`Bench tech — bonus` still on the line in Q2).

- [ ] **Step 5: Changelog and commit.**
  - `- The bottom bar is one row: Timeout, Undo, Log, End Q and ⋯. All seven player cards fit on an iPhone 13 screen without scrolling.`
  - `- Bench tech moved from the bottom bar to a Bench card at the end of the player cards.`

```bash
git commit -am "Live: one-row bottom bar, Bench card for bench techs"
```

---

### Task 3: A finished game looks finished; Final can end early or reopen

Decisions 5, 6, 23, 24. Owner ruling 1. Rulings 4, 5.

**Files:**
- Modify: `src/core/reconcile.ts`, `src/core/reconcile.test.ts`
- Modify: `src/ui/live-logic.ts`, `src/ui/live-logic.test.ts`
- Modify: `src/ui/StatusStrip.tsx`, `src/ui/Live.tsx`, `src/ui/EndGame.tsx`
- Modify: `e2e/full-game.spec.ts`, `e2e/game.spec.ts`

**Interfaces:**
- Produces, in `reconcile.ts`: `export function reopenGame(g: Game, now: Date): Game` — removes
  `endedAt`, keeps `currentPeriod`, touches `updatedAt`; returns `g` unchanged when not ended.
- Produces, in `live-logic.ts`:
  - `export function stripPeriodText(period: number, ended: boolean): string` → `'Final'` or
    `periodLabel(period)`.
  - `export type EndSlot = { text: string; opens: 'endPeriod' | 'endSheet' | 'final' }`
  - `export function endSlot(period: number, ended: boolean): EndSlot` →
    ended: `{ text: 'Final ▸', opens: 'final' }`; Q4+ : `{ text: 'End Q4…', opens: 'endSheet' }`;
    else `{ text: 'End Q1', opens: 'endPeriod' }`.
- `StatusStrip` gains prop `ended: boolean`.

- [ ] **Step 1: Write the failing tests.**

```ts
// reconcile.test.ts
it('reopenGame clears the end and keeps the period', () => {
  const ended = endGame({ ...g, currentPeriod: 5 }, NOW);
  const back = reopenGame(ended, LATER);
  expect(back.endedAt).toBeUndefined();
  expect(back.currentPeriod).toBe(5);
  expect(back.updatedAt).toBe(LATER.toISOString());
  expect(openIssues(back).map((i) => i.period)).not.toContain(5);
});
it('reopenGame leaves a live game alone', () => expect(reopenGame(g, NOW)).toBe(g));
// live-logic.test.ts
it('endSlot', () => {
  expect(endSlot(2, false)).toEqual({ text: 'End Q2', opens: 'endPeriod' });
  expect(endSlot(4, false)).toEqual({ text: 'End Q4…', opens: 'endSheet' });
  expect(endSlot(6, false)).toEqual({ text: 'End OT2…', opens: 'endSheet' });
  expect(endSlot(5, true)).toEqual({ text: 'Final ▸', opens: 'final' });
});
it('stripPeriodText', () => {
  expect(stripPeriodText(5, false)).toBe('OT1');
  expect(stripPeriodText(5, true)).toBe('Final');
});
```

  Use the file's existing fixtures for `g`/`NOW`; add `LATER` if absent.

- [ ] **Step 2:** Run `pnpm vitest run src/core/reconcile.test.ts src/ui/live-logic.test.ts`.
  Expected: FAIL.

- [ ] **Step 3: Implement** `reopenGame`, `endSlot`, `stripPeriodText`.

- [ ] **Step 4: Wire the screens.**
  - `StatusStrip`: shows `stripPeriodText(period, ended)`.
  - `Live.tsx`: the End slot renders `endSlot(...)`; `final` opens the Final view. Cut the
    "Game ended" bar from Task 1's line. ⋯ sheet: `Running score`, `Final / export` (only
    `setView('end')`), `New game`. The game still ends only from the Q4/OT sheet's
    `End game (no overtime)` / `End game (no more overtime)`, which then opens Final.
  - `EndGame.tsx`: title always `Final`; no header Back. Keep score, the two export buttons with
    description and per-file state, and the open quarters with notes. Cut the
    `Exported. / Not exported yet. The paper book stays official.` line and the
    "Anything still open is exported as…" note (it moves to How-to in Task 5). Footer, in order:
    `Back to game` (→ live), `New game` (→ setup, which shows the guard). Above the footer: when
    `game.endedAt`, `Reopen game` → `update(reopenGame, 'Reopened game')` then live; else
    `End game early` → a `Sheet` titled `End the game now?` with `End game` (calls `endGame`,
    label `End game`, stays on Final) and `Cancel`.

- [ ] **Step 5: Update e2e.**
  - Full-game helpers: `openEnd()` clicks `More` then `Final / export`; `backToLive()` clicks
    `Back to game`; `expectExportState` drops its region `toContainText` line. After
    `endPeriodThen('OT1', 'End game (no more overtime)')` and back on Live in the Book CSV step,
    `expectStrip` is called with `period: 'Final'`, and `expectBarOneRow()` sees `Final ▸`.
  - `game.spec.ts`: Final is reached via `Final / export`; `Back` becomes `Back to game`. Add a
    test `ended game: Final, reload, Reopen game` that starts a one-player game, ends Q1–Q3,
    taps `End Q4…` → `End game (no overtime)`, checks the strip reads `Final` and the End slot
    `Final ▸`, reloads, opens `Final ▸`, taps `Reopen game`, and checks the strip reads `Q4`,
    the End slot reads `End Q4…`, and no `Not exported` line shows. Add a second test: on a live
    game, ⋯ → `Final / export` → `End game early` → `Cancel` leaves the strip on its quarter;
    then `End game early` → `End game` makes it `Final`.

- [ ] **Step 6:** Run `pnpm check && pnpm test:e2e`. Expected: green.

- [ ] **Step 7: Changelog and commit.**
  - `- After End game the status strip reads Final and the End Q button becomes Final ▸. The separate "Game ended" bar is gone.`
  - `- The ⋯ menu's "Final / export" opens the Final screen without ending the game. Final offers "End game early" (with a confirm) while the game is live, and "Reopen game" once it has ended, even after a reload.`
  - `- The Final screen's footer is "Back to game" and "New game".`

```bash
git commit -am "Final: finished games look finished; end early or reopen from Final"
```

---

### Task 4: Log rows open Edit; move merges into Edit; insert-before is cut

Decisions 10–16. Ruling 8, 10.

**Files:**
- Modify: `src/ui/log-logic.ts`, `src/ui/log-logic.test.ts`
- Modify: `src/core/events.test.ts` (one `moveFrom` case)
- Modify: `src/ui/Log.tsx`, `src/ui/Reconcile.tsx`
- Modify: `e2e/full-game.spec.ts`, `e2e/game.spec.ts`

**Interfaces:**
- Changes: `groupByPeriod(g: Game, period?: number, order: 'newest' | 'oldest' = 'newest')` —
  `newest`: periods descending, events by `order` descending; `oldest`: both ascending.
- Produces in `log-logic.ts`:
  - `export function editTitle(g: Game, e: GameEvent): string` → `Fix: #12 +2 · Q1`
    (`eventLabel` + `periodLabel`).
  - `export function alsoMoveText(after: number, period: number): string` →
    `Also move the 1 play after it in Q3` / `Also move the 3 plays after it in Q3`.
  - `export function followersCount(g: Game, id: string): number` → `moveFromCount(g, id) - 1`
    (0 when absent).
  - `export function editSave(g: Game, e: GameEvent, d: EditDraft, alsoMove: boolean): { apply: (g: Game, now: Date) => Game; label: string } | null`
    — `null` when nothing changes. Without `alsoMove` (or no followers): `editEvent` with
    `editPatch` and label `editLabel`. With it and a changed period: `editEvent` with the patch
    minus `period`, then `moveFrom(e.id, d.period)`, in one `apply`; label
    `moveFromLabel(followers + 1, d.period)` when nothing else changed, else
    `${editLabel(g, e, patchWithoutPeriod)}; moved ${playsCount(followers + 1)} to ${periodLabel(d.period)}`.
- Removes: `insertLabel`, `moveFromTargets`, `moveFromSubtitle` and their tests. Keeps
  `moveFromCount`, `moveFromLabel`, `playsCount`, `addedLabel`. Keeps core `insertEventBefore`.

- [ ] **Step 1: Write the failing tests** in `log-logic.test.ts` (reuse its `game()` helper):
  - `groupByPeriod` default: periods `[2, 1]`, Q1 events `['FOUL', 'FG2']` (newest first);
    `groupByPeriod(g, 1, 'oldest')[0].events` types `['FG2', 'FOUL']`; still sorts by `order`
    when the array is reversed.
  - `editTitle` → `'Fix: #4 +2 · Q1'`; for a timeout `'Fix: Timeout (Full) · Q1'`.
  - `alsoMoveText(1, 3)` → `'Also move the 1 play after it in Q3'`; `(3, 3)` → `'... the 3 plays ...'`.
  - `editSave` with an unchanged draft → `null`.
  - `editSave` period-only, `alsoMove: true`, on the first of three Q3 plays → after `apply`,
    all three are in Q4 and label `'Moved 3 plays to Q4'`.
  - `editSave` player and period changed, `alsoMove: true` → the play has the new player, it
    and its followers are in Q4, label `'Edited #4 +2 → #0 +2; moved 3 plays to Q4'` (adjust the
    middle to what `editLabel` returns for that patch — assert the `; moved 3 plays to Q4`
    suffix and the `editLabel` prefix separately).
  - `editSave` period changed, `alsoMove: false` → only that play moves, label from `editLabel`
    (`'Moved #4 +2 to Q4'`).
  - In `events.test.ts`: `moveFrom` from Q1 to Q3 (non-adjacent) moves the block and leaves
    Q2 untouched.

- [ ] **Step 2:** Run `pnpm vitest run src/ui/log-logic.test.ts src/core/events.test.ts`.
  Expected: FAIL.

- [ ] **Step 3: Implement** the logic changes; delete the removed helpers and their tests.

- [ ] **Step 4: Rewrite the Log UI.**
  - Each row is a full-width bordered, rounded button with a trailing `›` (`aria-hidden`), its
    accessible name still starting with `eventRowText` (the `edited` tag may follow).
  - Tapping a row opens `EditSheet` directly, titled `editTitle(...)`. Groups have visible
    headings and `role="group"` labels `Play` (type, timeout kind or opponent points, whichever
    applies), `Player`, `Quarter` (renamed from `Period`). When the draft's quarter differs and
    `followersCount > 0`, a checkbox labeled `alsoMoveText(...)` shows, unchecked by default.
  - Footer: `Delete` (left; records `Deleted ${eventLabel}` with Undo), `Cancel`, `Save`
    (applies `editSave`).
  - Delete the actions sheet, the move sheet and both insert sheets.
  - `Reconcile.tsx`: the embedded log passes `'oldest'`; the Hide/Show toggle and `showLog`
    state go, the log always shows on a mismatch.

- [ ] **Step 5: Update e2e.**
  - Full-game helpers: `editPlayer` no longer clicks `Edit`. `moveFrom(rowScope, fromLabel,
    rowText, toLabel, after)` taps the row, picks `toLabel` in the `Quarter` group, checks the
    checkbox `Also move the ${after} play${after === 1 ? '' : 's'} after it in ${fromLabel}`,
    and saves; the Q3 call passes `after: 1`. Replace `insertBefore` with
    `addPlay(label, name, pts)`: in `fixRegion()`, click `Add play to ${label}`, the dialog's
    `#31 Player Six`, then `+2`. The Q2 step calls `app.addPlay('Q2', 'Player Six', '+2')`.
  - Plays CSV: replace the "insert sits right before #44" assertion with
    `expect(q2[q2.length - 1]).toBe('31 FG2')`. Update the header table's row 24 and the "(missed
    play goes before this)" note to say the play is added from the check at the end of Q2. No
    expected number changes; Player Six's Q2 marks stay `3 2`.
  - `game.spec.ts`: add `Log: newest first, tap to fix, Delete and Undo` — a one-player game
    with `+2` then `Foul`; in Log the first row is the foul; tap the `+2` row, the dialog is
    named `Fix: #4 +2 · Q1`; `Delete`; the line reads `Deleted #4 +2`; its Undo brings the row
    back.

- [ ] **Step 6:** Run `pnpm check && pnpm test:e2e`. Expected: green.

- [ ] **Step 7: Changelog and commit.**
  - `- Log rows look like buttons, and the Log lists the newest quarter and the newest play first. The quarter check's list stays oldest first, to walk beside the book.`
  - `- Tapping a Log row opens the fix directly, titled with the play, for example "Fix: #12 +2 · Q1", with Play, Player and Quarter groups and Delete at the bottom.`
  - `- Moving a play to another quarter is in the fix's Quarter group, with "Also move the plays after it" for a missed End Q.`
  - `- "Add a missed play before this" is gone. Add a missed play from the quarter check's "Add play to Q…"; it goes at the end of that quarter.`
  - `- The quarter check always shows its plays on a mismatch; the Hide/Show toggle is gone.`

```bash
git commit -am "Log: rows open the fix directly; move merges into it; insert-before cut"
```

---

### Task 5: How to use page, ⋯ entry, running-score legend

Decisions 25, 26, 29 (text only; images in Task 7), 21 (the content's home). Ruling 3.

**Files:**
- Create: `src/ui/howto-content.ts`, `src/ui/howto-content.test.ts`, `src/ui/HowTo.tsx`
- Modify: `src/ui/store.ts`, `src/ui/App.tsx`, `src/ui/Live.tsx`
- Modify: `src/ui/running-logic.ts`, `src/ui/running-logic.test.ts`, `src/ui/RunningScore.tsx`
- Modify: `e2e/full-game.spec.ts`

**Interfaces:**
- `store.ts`: `View` adds `'howto'`; store gains `howtoReturn: View` and
  `openHowto(from: View): void`. Opening and leaving How-to never touches `state.current`.
- `howto-content.ts`:
  - `export interface HowtoSection { id: string; title: string; body: string[]; image?: { src: string; alt: string } }`
  - `export const HOWTO_SECTIONS: HowtoSection[]` — the 12 sections of the spec's table, in
    order, titles verbatim: `What this is`, `Before tip-off`, `Record a play`, `Free throws`,
    `Timeouts and bench techs`, `Their points`, `Mistakes`, `End of quarter`,
    `Overtime and end of game`, `Export`, `Reading the screen`, `If something's wrong`. One or
    two sentences each. Required content: 2 has the iPhone "Share → Add to Home Screen keeps your
    roster saved between games" tip and names Game details; 5 says bench techs are on the Bench
    card; 7 says Undo, or Log then tap the line; 9 covers End game early and Reopen game; 10 has
    the 72-hour clear and that open quarters export as pending / unresolved; 11 includes
    `MARK_LEGEND`; 12 has the not-saving banner and that a reload keeps plays but clears Undo.
- `running-logic.ts`: `export const MARK_LEGEND: string` naming `X` (2), `●` (3), `/` (FT made),
  the shaded skipped cells and the amber end-of-quarter edge.
- `HowTo.tsx`: header `Back` (→ `howtoReturn`) and `How to use`; sections as `<section
  aria-label={title}>`; section 12 ends with `v{__APP_VERSION__}`.

- [ ] **Step 1: Write the failing tests.**

```ts
// howto-content.test.ts
it('has the twelve sections in order', () =>
  expect(HOWTO_SECTIONS.map((s) => s.title)).toEqual([
    'What this is', 'Before tip-off', 'Record a play', 'Free throws', 'Timeouts and bench techs',
    'Their points', 'Mistakes', 'End of quarter', 'Overtime and end of game', 'Export',
    'Reading the screen', "If something's wrong",
  ]));
it('keeps each section short', () => HOWTO_SECTIONS.forEach((s) => expect(s.body.length).toBeLessThanOrEqual(2)));
it('puts bench techs on the Bench card', () => expect(byTitle('Timeouts and bench techs').body.join(' ')).toMatch(/Bench card/));
it('carries the iPhone home-screen tip', () => expect(byTitle('Before tip-off').body.join(' ')).toMatch(/Add to Home Screen/));
it('carries the running-score legend', () => expect(byTitle('Reading the screen').body.join(' ')).toContain(MARK_LEGEND));
// running-logic.test.ts
it('MARK_LEGEND names every mark', () => ['X', '●', '/'].forEach((m) => expect(MARK_LEGEND).toContain(m)));
```

- [ ] **Step 2:** Run `pnpm vitest run src/ui/howto-content.test.ts src/ui/running-logic.test.ts`.
  Expected: FAIL.

- [ ] **Step 3: Implement** the content, `MARK_LEGEND`, `HowTo.tsx`, the store view and
  `App.tsx` route. ⋯ menu order becomes `How to use · Running score · Final / export · New game`
  (`How to use` → `openHowto('live')`). `RunningScore` shows `MARK_LEGEND` as one line under its
  header.

- [ ] **Step 4: Update e2e.** Full-game helpers: `openHowto()` (⋯ → `How to use`, expect
  heading `How to use`), `closeHowto()` (Back). In Q1, between the mis-tap and `app.undo()`:
  `openHowto()`, `closeHowto()`, then the existing undo and its `6–2` strip check stand as the
  proof that Undo survived.

- [ ] **Step 5:** Run `pnpm check && pnpm test:e2e`. Expected: green.

- [ ] **Step 6: Changelog and commit.**
  - `- A "How to use" page, from the ⋯ menu, explains the app in short sections. It works offline, and opening it keeps the game and Undo.`
  - `- The running score shows a one-line legend of its marks.`

```bash
git add -A src e2e CHANGELOG.md && git commit -m "How to use page and running-score legend"
```

---

### Task 6: Setup: opponent and roster first, Game details folded

Decisions 17–22.

**Files:**
- Modify: `src/core/storage.ts`, `src/core/storage.test.ts`
- Modify: `src/ui/roster.ts`, `src/ui/roster.test.ts`
- Modify: `src/ui/Setup.tsx`
- Modify: `e2e/full-game.spec.ts`, `e2e/game.spec.ts`

**Interfaces:**
- `storage.ts`: `export const PREFS_KEY = 'benchbook:prefs'`;
  `export interface Prefs { trackOpponentTaps: boolean }`;
  `export function loadPrefs(s: Storage): Prefs` (default `{ trackOpponentTaps: false }` on
  missing or malformed); `export function savePrefs(s: Storage, p: Prefs): boolean`.
- `roster.ts`: `export function cleanRoster(players: Player[]): Player[]` — trims `number` and
  `name`, sets `pos` to `''`.

- [ ] **Step 1: Write the failing tests.**
  - `storage.test.ts`: `loadPrefs` on empty storage → `{ trackOpponentTaps: false }`;
    round-trips `true` and then `false`; malformed JSON and `{"trackOpponentTaps":"yes"}` →
    default.
  - `roster.test.ts`: `cleanRoster([{ id: 'a', number: ' 4 ', name: ' Player One ', pos: 'G' }])`
    → `[{ id: 'a', number: '4', name: 'Player One', pos: '' }]`.

- [ ] **Step 2:** Run `pnpm vitest run src/core/storage.test.ts src/ui/roster.test.ts`.
  Expected: FAIL.

- [ ] **Step 3: Implement** `loadPrefs`, `savePrefs`, `cleanRoster`.

- [ ] **Step 4: Rebuild Setup.** Top to bottom: `New game` heading, the update banner, a link-
  styled button `First time here? How to use` (→ `openHowto('setup')`), a row with the Opponent
  input and a compact Home/Away two-segment group (keep `role="group"`
  `aria-label="Home or away"` and `aria-pressed`), the Roster (rows are `#`, `Name`, `×`; the POS
  input is gone), `Add player`, then a closed `<details>` with `<summary>Game details</summary>`
  holding Date (default today), Our team, Coach, Scorer, Timekeeper,
  `Also keep their score (Opp +1/+2/+3)` (initial value from `loadPrefs`), and
  `Clear saved roster`, which opens a `Sheet` titled `Clear the saved roster from this device?`
  with `Clear` and `Cancel`. Errors, then `Start game` (saves `cleanRoster(...)` and
  `savePrefs`). The iOS tip and the version line leave Setup.
  - New-game guard: when `isExported(game)`, show `Exported ✓` and make `Discard and start new`
    the amber primary with `Export` secondary; otherwise as today. No version line.

- [ ] **Step 5: Update e2e.**
  - Full-game `fillSetup`: no position fills; click `Game details` before filling `Our team`
    and checking the opponent-taps box. Drop `pos` from `ROSTER` (the Book CSV header is still
    found by its `POS` cell).
  - `game.spec.ts`: drop the position fills and the `pos` fields; replace the version check
    with: tap `First time here? How to use`, expect `v${pkg.version}`, `Back` returns to
    `New game`. In the second-game test, after Discard, open `Game details` and expect the
    opponent-taps box to be in the state the first game used. Add `Clear saved roster: Cancel
    keeps it, Clear empties it` (start a game, discard back to Setup, open Game details, Clear →
    Cancel keeps `Player 1 name` = `Player One`; Clear → Clear leaves it empty).

- [ ] **Step 6:** Run `pnpm check && pnpm test:e2e`. Expected: green.

- [ ] **Step 7: Changelog and commit.**
  - `- Setup starts with the opponent, Home/Away and the roster, plus a "First time here? How to use" link. Date, team, coach, scorer, timekeeper and "Also keep their score" fold into Game details.`
  - `- "Also keep their score" is remembered from the last game.`
  - `- The roster no longer asks for positions; the Book CSV's POS column is left blank.`
  - `- "Clear saved roster" is in Game details and asks first.`
  - `- The iPhone home-screen tip and the version moved to How to use.`
  - `- Starting a new game over an exported one says "Exported ✓" and makes Discard the main button.`

```bash
git commit -am "Setup: opponent and roster first, Game details folded, POS cut"
```

---

### Task 7: How-to screenshots, run by `pnpm release`

Decisions 27, 28. Ruling 9.

**Files:**
- Create: `e2e/fixture.ts` (moved from the full-game spec's top), `scripts/howto/shots.spec.ts`,
  `playwright.howto.config.ts`, `public/howto/reading-the-screen.png`,
  `public/howto/mistakes.png`, `public/howto/end-of-quarter.png`
- Modify: `e2e/full-game.spec.ts`, `package.json`, `scripts/release-lib.mjs`,
  `scripts/release-lib.test.mjs`, `scripts/release.mjs`, `src/ui/howto-content.ts`,
  `src/ui/howto-content.test.ts`, `src/core/precache.test.ts`, `CLAUDE.md`, `README.md`

**Interfaces:**
- `e2e/fixture.ts` exports `ROSTER`, `Name`, `TEAM`, `OPPONENT`, `STATUS`, `Status`,
  `timeoutsText`, `ui(page)` and `expectNoOverflow(page)`, moved verbatim with their comments;
  `full-game.spec.ts` keeps its hand-worked table and the test body and imports the rest. The
  fixture still imports nothing from `src/`.
- `package.json`: `"howto:shots": "playwright test -c playwright.howto.config.ts"`.
- `playwright.howto.config.ts`: spreads `playwright.config.ts`, with `testDir: 'scripts/howto'`
  and `use: { ...base.use, deviceScaleFactor: 2 }`, so `pnpm test:e2e` never runs it.
- `executeRelease(next, steps, say)`: `steps` gains `shots: () => void`, run after `e2e` and
  before `write`.

- [ ] **Step 1: Write the failing tests.**
  - `release-lib.test.mjs`: the steps run in the order `check, e2e, shots, write, commit, tag`;
    when `shots` throws, the result is `1`, `write` is never called, and `say` gets
    `Screenshots failed; nothing was released. Restore the images with: git checkout -- public/howto`;
    the commit-failure message now ends `git checkout -- package.json CHANGELOG.md public/howto`.
  - `howto-content.test.ts`: the sections titled `Reading the screen`, `Mistakes` and
    `End of quarter` have images `/howto/reading-the-screen.png`, `/howto/mistakes.png`,
    `/howto/end-of-quarter.png`; every `image.src` ends in `.png` and exists under `public/`
    (`existsSync(new URL('../../public' + src, import.meta.url))`); no other section has one.
  - `precache.test.ts`: `it.skipIf(text === undefined)` that `sw.js` lists each of the three
    `howto/*.png` (Workbox skips files over 2 MiB, so a too-large PNG fails here).

- [ ] **Step 2:** Run `pnpm vitest run scripts/release-lib.test.mjs src/ui/howto-content.test.ts`.
  Expected: FAIL.

- [ ] **Step 3: Extract `e2e/fixture.ts`** and run `pnpm test:e2e`. Expected: green, no
  behavior change.

- [ ] **Step 4: Write `scripts/howto/shots.spec.ts`** with the fixture's `ui(page)` and
  `ROSTER` (no second scripted game): Setup with taps on; in Q1 a few plays that give one player
  4 fouls (amber), a timeout and opponent points; screenshot Live to
  `public/howto/reading-the-screen.png`. Open Log, tap a row so its fix sheet shows; screenshot
  `mistakes.png`; Cancel, Back. `End Q1`, tap the check prompt, type the book's number;
  screenshot `end-of-quarter.png`. Full-viewport screenshots only. Run `pnpm howto:shots` and
  check the three files exist and each is under 1 MiB.

- [ ] **Step 5: Wire the release.** Add `shots` to `executeRelease` and its message; in
  `release.mjs` `shots: () => pnpm('howto:shots')`, and `commit` runs
  `git add public/howto` then `git commit -m "Release v…" -- package.json CHANGELOG.md public/howto`.
  Add the three `image` fields to `howto-content.ts` and render them in `HowTo.tsx` (`<img>` with
  `alt`, `width` 100%, `loading="lazy"`).

- [ ] **Step 6: Docs.** `CLAUDE.md` under Commands: `pnpm howto:shots` refreshes
  `public/howto/*.png` and `pnpm release` runs it; a hand-made image gets a new filename and is
  referenced from `src/ui/howto-content.ts`, so a release never overwrites it. `README.md`'s
  "How a game works": Setup without positions and with Game details, the Bench card, the
  feedback line, Log rows that open the fix, Final / Reopen, and a pointer to How to use.

- [ ] **Step 7:** Run `pnpm check && pnpm test:e2e && pnpm build && pnpm vitest run src/core/precache.test.ts`.
  Expected: green, with the precache cases running (not skipped).

- [ ] **Step 8: Changelog and commit.**
  - `- How to use shows three screenshots, refreshed on every release, and they are saved for offline use.`

```bash
git add -A e2e scripts src public/howto playwright.howto.config.ts package.json CLAUDE.md README.md CHANGELOG.md
git commit -m "How-to screenshots from the full-game fixture, refreshed by pnpm release"
```

---

### Task 8: Rerun the four persona agents (controller)

The controller runs this; no implementer subagent. "How we'll know" in the spec.

- [ ] **Step 1:** Confirm `master` is green: `pnpm check && pnpm test:e2e`. Grep that
  `insertLabel`, `moveFromTargets`, `moveFromSubtitle`, `clearToast` and the POS input are gone,
  and that `insertEventBefore`, `Player.pos` and `GameEvent.order` remain with their tests.
- [ ] **Step 2:** Rerun the four personas (parent, novice, veteran, and the fourth from the
  2026-11-11 swarm) with the **same brief and scenario** as that swarm, against a fresh
  `pnpm build && pnpm preview` on the iPhone 13 viewport. The brief lives in that session, not
  the repo (ruling 11).
- [ ] **Step 3: Judge against the spec.**
  - The parent and the novice finish every event without guessing.
  - The veteran's taps per action do not exceed the Goals table: basket/foul 2, opponent
    points 1, timeout 2, FT pair 4, end of quarter plus check 4.
  - No persona records a ref's call wrongly because a control moved, in particular a bench tech
    charged as a player's Tech foul, or a bench tech hunted for more than about 10 seconds.
  - The full-game e2e test passed with its expected numbers unchanged (check
    `git diff 0b6feb4 -- e2e/full-game.spec.ts` touches no number in the table or the CSV
    expectations except the Q2 order assertion, ruling 10).
- [ ] **Step 4:** For each riskiest-cut trigger in the spec that a persona hit, record it and
  the add-back it calls for; build nothing in this task. Report to the owner, then release with
  `pnpm release minor` only on the owner's go-ahead. Never push.
