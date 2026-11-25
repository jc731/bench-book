# Earlier Quarter Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quarter tabs on the check page, a More → "Quarter checks" item, and a per-player table for the quarter being checked, released as 1.2.0.

**Architecture:** Pure rules in `src/ui/reconcile-logic.ts` (which tabs, their status and label; the per-player rows for a quarter; when the menu item shows), unit-tested. `Reconcile.tsx` renders the tab row and the table; `Live.tsx` adds the menu item. Switching tabs reuses the existing Later draft path and `openReconcile`.

**Tech Stack:** Astro, Preact, Tailwind 4, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-25-earlier-quarter-checks-design.md`

## Global Constraints

- Tabs: one per finished period (`p < currentPeriod`, plus `p === currentPeriod` once `endedAt` is set), in period order. Text = `periodLabel(p)`. Tone = the Book chip's: green (`bg-emerald-700 text-white`) matched/fixed, amber (`bg-amber-400 text-slate-900`) unresolved, gray (`bg-slate-600 text-white`) pending/noted. The open quarter's tab carries `aria-current="page"` and a 2 px white ring. Accessible name `Q1, ✓ Matched` (label, comma, `statusChipText`).
- Tapping a tab: save the leaving quarter's typed fields as a draft exactly as Later does (`setCheckDraft` via `quiet`, blank fields keep nothing), then `openReconcile(p, reconcileReturn)`.
- More item text: `Quarter checks`. Shown iff `currentPeriod > 1 || endedAt`. Opens `openReconcile(latestFinished, 'live')`.
- Table heading: `Players in Q2 (compare with the book)`. Columns: `#` + name, `Pts Q2`, `Fouls Q2`, `Fouls game`. Home first (as `foulSidesOf`). No number row when that team has a no-number play (`statsGrid` rows already include it as key `none`). Team-fouls line stays above the table.
- US English, gender-neutral prose, invented test names. Commit on master; no attribution trailer; never push. Any replaced or deleted assertion is named in the commit message.

## Review Focus

1. A tab tap while the Add-play sheet is open: the sheet closes with the quarter (Task 2 resets `addStep` on period change; e2e not required).
2. A tab with a draft already saved by Later: switching away saves the current text over it, coming back seeds from it (Task 2 e2e, invariant 2).
3. A one-team game (no opponent roster or plays): one table, as the fouls section is today (Task 1 unit: `foulSidesOf` reuse).
4. OT: a tab reads `OT1` (Task 1 unit).
5. The menu item in a game ended in Q4: the latest finished period is 4 (Task 1 unit).

---

### Task 1: Pure rules

**Files:** Modify `src/ui/reconcile-logic.ts`; test `src/ui/reconcile-logic.test.ts`.

**Produces:**
- `checkTabs(g: Game): { period: number; label: string; status: PeriodStatus; text: string; tone: 'done' | 'off' | 'plain' }[]` — `text` is `statusChipText(status)`, `tone` done for matched/fixed, off for unresolved, plain otherwise.
- `quarterChecksAvailable(g: Game): boolean` and `latestFinishedPeriod(g: Game): number`.
- `quarterPlayerRows(g: Game, side: Side, period: number): { key: string; who: string; pts: number; fouls: number; gameFouls: number }[]` — `who` is `#12 Name` (trimmed) or `No number`; built from `statsGrid(g, side)` (the cell for `period`) and that row's total fouls. Export `QUARTER_CHECK_TEXT = 'Quarter checks'` and `playersHeading(period: number): string` → `Players in Q2 (compare with the book)`.

- [ ] Tests (sources: spec Decided 1–3; Review Focus 3–5): a fresh game has no tabs; after `endPeriod` once, one tab `Q1` pending `Not checked` plain; a saved matched check reads done `✓ Matched`; an unresolved one off; OT label `OT1`; an ended game in Q4 lists Q1–Q4 and `latestFinishedPeriod` is 4; `quarterChecksAvailable` false fresh, true after End Q1; `quarterPlayerRows` for a game with #4 +2 and a foul in Q1 and +3 in Q2 reads `{who:'#4 Player One', pts:2, fouls:1, gameFouls:1}` for Q1 and `pts:3` for Q2; a no-number FG2 adds a `No number` row; the sum of `pts` over rows equals `derive(g).usByPeriod[period]` (invariant 3).
- [ ] Run `pnpm vitest run src/ui/reconcile-logic.test.ts` → FAIL; implement; `pnpm check` → PASS; commit `1.2: rules for quarter tabs, the menu item and the per-player quarter table`.

### Task 2: The check page, the menu item, e2e, How-to, CHANGELOG

**Files:** Modify `src/ui/Reconcile.tsx`, `src/ui/Live.tsx` (More sheet), `src/ui/howto-content.ts` (+ its test if it pins wording), `CHANGELOG.md`; test `e2e/game.spec.ts` (or a new `e2e/quarter-checks.spec.ts`).

**Consumes:** Task 1's exports.

- [ ] Reconcile.tsx: render the tab row under the header (`role="tablist"`-free: plain buttons in a `flex gap-1.5 overflow-x-auto` row, each with the tone classes and `aria-current`); `switchTo(p)` = the Later draft save without `setView`, then `openReconcile(p, reconcileReturn)`; reset `addStep`/`addPlayer`/`addSide` when `period` changes. Replace the "Player fouls, whole game" block with the per-side table from `quarterPlayerRows` (a `<table>` with `<th scope="col">`, `aria-label` `${side} players in Q2` when both teams show). Keep the existing test ids.
- [ ] Live.tsx: More sheet gains `Quarter checks` (same `opt` style, after "Running score") when `quarterChecksAvailable(game)`, calling `openReconcile(latestFinishedPeriod(game), 'live')`.
- [ ] e2e (fake clock not needed): (a) invariant 1+2: End Q1, End Q2; from the Q2 check type `18` in Our score, tap tab `Q1` → heading `Check Q1`, saved game unchanged (localStorage `benchbook:game` equal before/after), tap tab `Q2` → the field reads `18` again; (b) invariant 4: More has no `Quarter checks` before End Q1, has it after, and it opens `Check Q1`; (c) invariant 3 on the page: after #4 +2, #4 Foul in Q1, End Q1, the Q1 table row `#4 Player One` reads `2 | 1 | 1`, and the Team-fouls line still shows. Replace, and name in the commit, the whole-game-fouls assertions at `e2e/game.spec.ts:622` with table ones.
- [ ] How-to "End of quarter" section: a sentence on the tabs and More → Quarter checks; "Fixing a mistake" mentions it as the way back to an earlier quarter. CHANGELOG Unreleased bullets (three).
- [ ] `pnpm check && pnpm test:e2e` → PASS; commit `1.2: quarter tabs on the check, More → Quarter checks, per-player quarter table`.

### Release (controller): `pnpm release minor` → 1.2.0; push only on the owner's word.
