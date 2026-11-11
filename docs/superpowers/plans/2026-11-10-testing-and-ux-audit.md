# Release test, versioning and first-timer UX audit: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every version bump is guarded by a full-game browser test run through
`pnpm release`. On demand, a blind first-timer agent audits the UI and writes a dated report.

**Architecture:**
- **Versioning:** a root `CLAUDE.md`, plus `CHANGELOG.md`, plus `pnpm release`. The release
  script is a Node script whose decision logic lives in pure, tested helpers.
- **Release test:** one long Playwright spec. Its expected values are written by hand.
- **Audit:**
  - a project-scoped Playwright MCP server (`ux-browser`, iPhone 13, isolated profile,
    local Chromium);
  - a `ux-persona` agent whose **only** tools are that server's browser tools. It has no
    Bash and no file tools, so being blind to the repo is built into the agent, not a
    prompt rule;
  - a `/ux-audit` skill that the controller session follows. It runs the audit, then checks
    the persona's transcript with a small tested script for disallowed tools and URLs and
    for per-event action counts, compares the CSVs with the expected end state, and writes
    the report.

**Tech Stack:** Node 22 ESM scripts, Vitest, Playwright, `@playwright/mcp`, Claude Code
skills and agents, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-10-testing-and-ux-audit-design.md`, which the
executor must read first.

## Global Constraints

- Only invented names in every fixture, scenario, report and screenshot (`Player One`,
  `Test Opp`). The repo is public.
- `pnpm release` never pushes. It refuses to run if:
  - the working tree isn't clean;
  - the branch isn't `master`;
  - the tag already exists;
  - `Unreleased` is empty;
  - `pnpm check` or `pnpm test:e2e` fails.
- The release test's expected values are written by hand. **The spec must not import
  anything from `src/`.**
- **The persona agent never reads the repo.** Its tools are the `ux-browser` MCP browser
  tools only. The root `CLAUDE.md` may load into its context, so it must contain **no UI
  vocabulary** (no button names, screen names or flows): process rules only.
- **A run is void** if the persona transcript shows any tool outside the allowlist, or a
  `browser_navigate` to anything other than the app URL.
- The audit writes reports only. It never edits app code.
- No push and no deploy from any script or skill.
- US English in all prose, copy, comments and commit messages. Commits carry no
  Claude/Anthropic attribution trailer.
- `pnpm check` (astro check, tsc, vitest) is the per-commit gate. Run `pnpm test:e2e` for
  any task that touches `e2e/` or the UI.

## Review Focus

1. **A release that fails halfway** must leave no version bump, no changelog move, no
   commit and no tag. Every check runs before the first write. Pinned in Task 2:
   `planRelease refuses before any write`.
2. **A tag that already exists, or a version that goes backward,** must be refused (Task 2
   test `refuses existing tag`).
3. **The persona reaches the code anyway,** for example by navigating to a `file://` URL
   or a JS bundle. The transcript check must catch it (Task 4 test
   `flags navigate outside app URL`).
4. **The transcript check passes on an empty or truncated transcript.** It must report
   "no persona tool calls found" and void the run (Task 4 test `empty transcript is void`).
5. **The persona sees the expected end state,** and the audit becomes worthless. The skill
   must give the persona only the events section of `scenario.md`, never the
   expected-state section (Task 5, verification step).

---

## File Structure

```
CLAUDE.md                              versioning + release + audit rules for every session
CHANGELOG.md                           Keep a Changelog; 0.1.0 entry + Unreleased
src/ui/Setup.tsx                       shows v{version}
astro.config.mjs                       vite.define __APP_VERSION__ from package.json
src/env.d.ts                           declare const __APP_VERSION__: string
scripts/release-lib.mjs                pure: bumpVersion, moveUnreleased, planRelease
scripts/release-lib.test.mjs
scripts/release.mjs                    CLI wrapper (git/pnpm side effects)
vitest.config.ts                       include scripts/**/*.test.mjs
e2e/full-game.spec.ts                  the release test
.mcp.json                              project MCP server `ux-browser` (@playwright/mcp, pinned)
scripts/ux-audit/transcript-stats.mjs  pure: analyzeTranscript(jsonlText, opts) + CLI
scripts/ux-audit/transcript-stats.test.mjs
docs/ux-audit/personas/bookkeeper.md
docs/ux-audit/scenario.md              ## Events (persona sees) / ## Expected end state (controller only)
.claude/agents/ux-persona.md           tools: ux-browser browser tools only
.claude/skills/ux-audit/SKILL.md       controller procedure
docs/ux-audit/reports/v0.1.0.md        first audit (Task 6)
```

---

### Task 1: Versioning rules, changelog, version on screen

**Files:**
- Create `CLAUDE.md` and `CHANGELOG.md`.
- Modify `astro.config.mjs`, `src/env.d.ts` (create it if absent), `src/ui/Setup.tsx`,
  `e2e/game.spec.ts` and `README.md`.

**Interfaces:**
- Produces a global `__APP_VERSION__: string`, injected via `vite.define` from
  `package.json`'s `version`.

- [ ] **Step 1:** In `astro.config.mjs`, read `package.json` (`fs` + `JSON.parse`) and
  set `vite.define: { __APP_VERSION__: JSON.stringify(pkg.version) }`. Declare it in
  `src/env.d.ts`.
- [ ] **Step 2:** In `Setup.tsx`, show `v{__APP_VERSION__}` in small, muted text at the
  bottom of the Setup form and of the in-progress prompt.
- [ ] **Step 3:** In `e2e/game.spec.ts`, assert at the start that the Setup screen shows
  the text `v0.1.0`. Read the expected value from `package.json` in the spec, so a bump
  doesn't break it.
- [ ] **Step 4:** Write `CHANGELOG.md` in Keep a Changelog format:
  - an empty `## [Unreleased]`;
  - `## [0.1.0] - 2026-11-10`, summarizing Phase 1 as built, in 6–10 bullets: setup with a
    remembered roster, live entry with undo, IESA/NFHS fouls and bonus, timeouts, the
    quarter check against the book, the log, the running score, the two CSV exports, and
    offline use.
- [ ] **Step 5:** Write `CLAUDE.md`, the project instructions. It must state:
  - the version scheme table from the spec's Versioning section, and that the phases are
    called "Phase 1/2/3";
  - **Claude owns versioning.** When user-visible work lands, add an `Unreleased` bullet to
    `CHANGELOG.md`. When a batch is done, release with
    `pnpm release <patch|minor|major>`, never by hand-editing `version`. Minor for a batch
    of fixes or features, patch for a single bug fix, major only when the owner declares a
    phase milestone;
  - that `pnpm release` runs the full-game test and never pushes, and that pushing deploys
    to Netlify, so pushes need the owner's go-ahead;
  - the UX audit cadence (0.1, around 0.5, 1.0, then each new phase), and that it runs as
    `/ux-audit`;
  - the commands (`pnpm check`, `pnpm test:e2e`, `pnpm release`) and the US-English and
    no-attribution-trailer rules.
- [ ] **Step 6:** README: add a short "Releases" note pointing at `CHANGELOG.md` and
  `pnpm release`. Add "tablet-size release test (after 1.0)" to a Backlog list.
- [ ] **Step 7:** Run `pnpm check && pnpm test:e2e`. Expected: both pass, and the e2e run
  asserts `v0.1.0`.
- [ ] **Step 8:** Commit: `Add versioning rules, changelog and version on Setup`.

---

### Task 2: `pnpm release`

**Files:**
- Create `scripts/release-lib.mjs`, `scripts/release-lib.test.mjs` and
  `scripts/release.mjs`.
- Modify `vitest.config.ts` (add `'scripts/**/*.test.mjs'` to `include`) and
  `package.json` (add the script `"release": "node scripts/release.mjs"`).

**Interfaces — Produces (`release-lib.mjs`, pure, with JSDoc types):**

```js
export function bumpVersion(version, kind)        // '0.1.0','minor' → '0.2.0'; 'patch' → '0.1.1'; 'major' → '1.0.0'; throws on bad kind or non x.y.z
export function moveUnreleased(changelog, version, date) // returns new text: Unreleased bullets moved under `## [version] - date`, empty `## [Unreleased]` kept on top; throws 'Unreleased is empty'
export function planRelease({ branch, clean, tags, version, kind, changelog, date })
// → { ok: true, next, newChangelog } | { ok: false, reason }
// reasons, checked in this order: 'not on master', 'working tree not clean', 'Unreleased is empty', `tag v${next} exists`
```

`release.mjs` order:
1. Gather facts: `git rev-parse --abbrev-ref HEAD`, `git status --porcelain`, `git tag`,
   `package.json` and `CHANGELOG.md`.
2. `planRelease`. On failure, print the reason and exit 1.
3. Run `pnpm check` then `pnpm test:e2e` (stdio inherited). On failure, exit 1 without
   writing anything.
4. Write `package.json` and `CHANGELOG.md`.
5. `git commit -am "Release v{next}"`, then `git tag v{next}`.
6. Print `Released v{next}. Push when ready: git push && git push --tags`.

- [ ] **Step 1: Write the failing tests** in `release-lib.test.mjs`:
  - `bumpVersion`: `('0.1.0','minor')` gives `'0.2.0'`, `('0.1.3','patch')` gives `'0.1.4'`,
    `('0.9.2','major')` gives `'1.0.0'`; `('0.1','minor')` throws; `('0.1.0','huge')`
    throws.
  - `moveUnreleased`: a changelog whose Unreleased holds two bullets, moved to `0.2.0` on
    `2026-11-20`, gives output with exactly one `## [Unreleased]`, immediately followed
    (after a blank line) by `## [0.2.0] - 2026-11-20` and the two bullets, with the older
    `## [0.1.0]` section unchanged. An empty Unreleased throws `/Unreleased is empty/`.
  - `planRelease refuses before any write`: each failing fact returns `{ok:false}` with
    its exact reason string. Give two failing facts at once and assert the reason follows
    the order listed above.
  - `refuses existing tag`: `tags: ['v0.2.0']`, `version: '0.1.0'`, `kind: 'minor'` gives
    the reason `'tag v0.2.0 exists'`.
  - happy path: returns `next` and a `newChangelog` containing `## [0.2.0] - <date>`.
- [ ] **Step 2:** Run `pnpm vitest run scripts`. Expected: FAIL (the module is missing).
- [ ] **Step 3:** Implement `release-lib.mjs`, then `release.mjs`. Use `execFileSync`; no
  shell strings.
- [ ] **Step 4:** Run `pnpm vitest run scripts`, then `pnpm check`. Expected: PASS.
- [ ] **Step 5:** Dry check, without releasing: run `pnpm release minor` in the current
  tree, where `Unreleased` is empty. Expected: `Unreleased is empty`, exit 1, and
  `git status` unchanged.
- [ ] **Step 6:** Commit: `Add pnpm release with pre-release checks`.

---

### Task 3: Full-game release test

**Files:** Create `e2e/full-game.spec.ts`.

**Interfaces:** None. It drives the UI only. Read `src/ui/` for accessible names, and use
`e2e/game.spec.ts` as the pattern for setup, the CSV download and parsing.

- [ ] **Step 1: Write the scenario as a comment table** at the top of the spec: every
  event per period and the running expected totals, worked out by hand. It must include
  everything in the spec's Part 1 "Scenario" list:
  - a 7-player roster with `0` and `00`, and opponent taps on;
  - 2s, 3s, made and missed FTs (sheet kept open), and opponent taps;
  - one quarter reaching the bonus at our 5th team foul, then a reset;
  - one foul-out on 5 fouls and one on 2 technicals;
  - a bench technical;
  - full, 30-second and OT timeouts;
  - an undone mis-tap, a Log edit, an insert-before, and a "Move this and everything
    after" repair of a missed End Q;
  - quarter checks giving matched, fixed, noted and pending;
  - Q4 ends tied, then OT1 with the foul count continuing from Q4;
  - End game, then both CSVs.
- [ ] **Step 2: Write the test** as one `test()` with `test.step`s per quarter. All UI
  wording lives in a few action helpers at the top of the file (`score(name, '+2')`,
  `ft(name, made)`, `foul(name)`, `endPeriod()`, `checkQuarter(us, opp)`…), so a copy change
  touches one place. After each
  step, assert:
  - the strip score;
  - the period label;
  - `Fouls N` and the bonus chip present or absent;
  - timeouts left;
  - foul states of the affected players (via the aria-label "N fouls", and OUT where it
    applies);
  - `scrollWidth <= 390` on every screen visited.

  After export, parse both CSVs (same helper style as `game.spec.ts`) and assert, all
  against the table's literal numbers:
  - Score by period: our and opponent cells for Q1–Q4 and OT1, and the totals;
  - each player's TP, FTA, FTM, FOULS and TECHS;
  - team fouls per period, as the raw per-period counts the CSV shows. The OT bonus
    carry-over is asserted on screen, through the bonus chip in OT1;
  - the timeouts-used rows;
  - the Reconcile statuses `matched`, `fixed`, `noted`, `pending` on the right periods;
  - the plays CSV row count equal to the number of events left after undo and edits, and
    the `detail` column for the three timeouts.
- [ ] **Step 3:** Run `pnpm test:e2e`. Expected: both specs PASS. If an expected value
  disagrees with the app, recheck the hand arithmetic first. If the app is wrong, stop and
  report it as a defect. Never change the expected value to match.
- [ ] **Step 4: Prove it can fail.** Temporarily change one value in the comparison of
  `src/core/derive.ts`'s bonus threshold (5 → 6) or in a CSV column, rebuild, and confirm
  the spec FAILS on the matching assertion. Revert. Record the mutation in the report.
- [ ] **Step 5:** Commit: `test: full-game release test`.

---

### Task 4: Persona browser (MCP) and transcript check

**Files:**
- Create `.mcp.json`, `scripts/ux-audit/transcript-stats.mjs` and
  `scripts/ux-audit/transcript-stats.test.mjs`.
- Modify `package.json`: add `@playwright/mcp` as a dev dependency at an exact version, and
  the script `"ux:stats": "node scripts/ux-audit/transcript-stats.mjs"`.

**Interfaces — Produces:**
- An MCP server named `ux-browser`. Claude Code tool names: `mcp__ux-browser__browser_*`.
- In `transcript-stats.mjs`:

```js
export const ALLOWED_TOOLS // ['browser_snapshot','browser_take_screenshot','browser_click','browser_type',
                           //  'browser_fill_form','browser_press_key','browser_wait_for','browser_navigate',
                           //  'browser_select_option','browser_handle_dialog'] (bare names; match by suffix after the server prefix)
export function analyzeTranscript(jsonlText, { appUrl })
// → { void: boolean, reasons: string[], toolCounts: Record<string,number>,
//     navigations: string[], perEvent: Record<number,{ actions: number }>, totalActions: number }
// reasons: 'no persona tool calls found' | `disallowed tool: ${name}` | `navigate outside app: ${url}`
// perEvent: action tool calls attributed to the most recent "Event N" marker in the
// persona's assistant text before the call (snapshot/screenshot/wait don't count as actions)
```

CLI: `node transcript-stats.mjs <transcript.jsonl> <appUrl>` prints the result as JSON, and
exits 2 when `void` is true.

- [ ] **Step 1: Configure the browser.** `.mcp.json` declares `ux-browser` running the
  pinned `@playwright/mcp` binary with these flags: isolated profile, the iPhone 13 device,
  headless, and Chromium. Check the package's `--help` for the exact flags. Use
  `--browser chromium` if it is supported. Otherwise use `--executable-path` pointing at
  Playwright's bundled Chromium, via an env var with a documented default, never a
  hard-coded `/usr/bin` path. Record the flags you used in the report.
- [ ] **Step 2: Verify it by hand,** outside Claude Code. Start the server once with the
  same command and flags, and confirm it launches with no "chrome not found" error. If
  `@playwright/mcp` can't run against Chromium here, STOP and report BLOCKED with the
  error. The controller will decide.
- [ ] **Step 3: Write the failing tests** for `analyzeTranscript`, using small hand-written
  jsonl fixtures in the test file, in the shape of Claude Code transcript lines: assistant
  messages with `tool_use` content blocks `{type:'tool_use', name, input}` and text blocks.
  - `allowed-only transcript is not void`, and `toolCounts` is correct.
  - `flags disallowed tool`: a `Bash` or `Read` `tool_use` gives `void` true, with reason
    `disallowed tool: Bash`.
  - `flags navigate outside app URL`: `browser_navigate` to `file:///home/x` or to
    `http://localhost:4410/_astro/app.js` gives void. The app URL itself is allowed, and so
    is the app URL with a hash or query.
  - `empty transcript is void`.
  - `perEvent`: text "Event 3: …", then two clicks and one snapshot, gives
    `perEvent[3].actions === 2`.
- [ ] **Step 4:** Run `pnpm vitest run scripts/ux-audit`. Expected: FAIL. Implement.
  Expected: PASS. Then run `pnpm check`.
- [ ] **Step 5:** Commit: `Add UX audit browser (MCP) and transcript check`.

---

### Task 5: Persona, scenario, agent and `/ux-audit` skill

**Files:** Create `docs/ux-audit/personas/bookkeeper.md`, `docs/ux-audit/scenario.md`,
`.claude/agents/ux-persona.md` and `.claude/skills/ux-audit/SKILL.md`.

- [ ] **Step 1: `bookkeeper.md`.** Describe the persona from the spec: knows bookkeeping
  and the stats, has never seen the app, has no help, is at a real game, under time
  pressure, using one thumb. Narration rules:
  - **start each event's work with `Event N:`** (the transcript check relies on this);
  - say what you expect before acting, and what happened after;
  - **take a screenshot when unsure** and judge by what the screen looks like, not only by
    the accessibility names. A volunteer sees icons and layout, not labels;
  - flag every hesitation; when stuck, record it and move on.

  Add a "Later persona" note for the "knows basketball, kind of" persona.
- [ ] **Step 2: `scenario.md`**, in two sections, with exactly these headings:
  - `## Events`: about 40 numbered game events across all four quarters, written as game
    happenings, never as UI instructions. They must cover the spec's audit list: start a
    game (the roster of 7 invented players is given as a coach's list), free throws, a
    foul-out, a timeout, undoing a mis-tap ("you tapped the wrong player"), fixing an
    earlier entry, End Q1–Q4 with End Q4 leading to the end of the game, a check against
    the book (one quarter matching, one not, using "your book says …" lines), ending the
    game, and exporting "the files your coach wants".
  - `## Expected end state`: the final score per quarter, each player's points and fouls,
    and the timeouts used, worked out by hand from the events.
- [ ] **Step 3: `.claude/agents/ux-persona.md`.**
  - Frontmatter: `name: ux-persona`, a description, and `tools:` listing exactly the
    `mcp__ux-browser__` versions of `ALLOWED_TOOLS` (Task 4). Do NOT list `browser_evaluate`,
    `browser_run_code*`, `browser_file_upload`, `browser_network_*`, Bash, Read or any file
    tool.
  - Body:
    - you play the persona given in the prompt;
    - you know nothing about this app beyond what its screens show;
    - navigate only to the URL you are given;
    - return the narration as a numbered list matching the event numbers, each with an
      outcome of `done`, `hesitated`, `failed` or `skipped`, plus your overall impressions.
- [ ] **Step 4: `.claude/skills/ux-audit/SKILL.md`.** Frontmatter: `name: ux-audit`, and a
  description saying it runs the first-timer UX audit and writes
  `docs/ux-audit/reports/v<version>.md`. The controller procedure:
  1. Read `package.json`'s version. The report path is `reports/v<version>.md`, or `-2`,
     `-3`… if that file already exists.
  2. `pnpm build`, then start `pnpm exec astro preview --port 4410 --ignore-lock` in the
     background. The app URL is `http://localhost:4410/`.
  3. Dispatch the `ux-persona` agent with:
     - the full text of `personas/bookkeeper.md`;
     - **only the `## Events` section** of `scenario.md`;
     - the app URL.
     Note the transcript file path the Agent tool returns.
  4. Run `pnpm ux:stats <transcript> http://localhost:4410/`. On exit 2, the run is
     **void**: write a short report saying why, and stop.
  5. Using the `ux-browser` tools as the controller, on the same browser session:
     - open End game / export;
     - download both CSVs;
     - compare them with `## Expected end state`. Each difference becomes a **wrong entry**
       finding.
     Copy the screenshots that findings cite into `docs/ux-audit/reports/v<version>/`.
  6. Write the report in the spec's format:
     - summary counts, the top 3 problems, and **per-event action counts from
       `ux:stats`** beside the persona's outcomes. Many actions on a "done" event is a
       hesitation even if the persona didn't say so;
     - findings with severity (blocked / wrong entry / hesitated / polish) and a suggested
       direction, framed as leads from a single run, not a scorecard;
     - when an earlier report exists, "Compared with v<prev>" (gone / still here / new).
  7. Stop the preview server.
  8. Never edit app code. Commit only the report and its screenshots, with the message
     `docs: UX audit v<version>`.
- [ ] **Step 5: Verify the information wall** without running the audit. Write exactly the
  prompt the skill would send the persona to a temp file. Confirm it contains no line
  from `## Expected end state` and no repo path. Also check that the root `CLAUDE.md`
  contains no UI vocabulary: no button or screen names.
- [ ] **Step 6:** Run `pnpm check`. Expected: PASS. Commit:
  `Add first-timer UX audit: persona, scenario, agent and skill`.

---

### Task 6: First audit, the v0.1.0 baseline (controller-run)

- [ ] **Step 0:** This task needs the owner. A new project MCP server (`.mcp.json`) needs
  their approval in Claude Code, and agent definitions load at session start, so it may
  need a session restart.
- [ ] **Step 1:** The controller follows `.claude/skills/ux-audit/SKILL.md` for v0.1.0.
- [ ] **Step 2:** Confirm `docs/ux-audit/reports/v0.1.0.md` exists, follows the format,
  and that its wrong-entry section reflects the CSV comparison.
- [ ] **Step 3: Calibrate.** Ask the owner whether the report caught what they already
  know trips people up. If it missed all of it, the audit isn't working yet. Say so rather
  than calling it a baseline.
- [ ] **Step 4:** Commit: `docs: UX audit v0.1.0`. Do not act on the findings. The owner
  reads the report and decides.
