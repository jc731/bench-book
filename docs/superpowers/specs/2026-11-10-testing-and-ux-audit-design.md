# Release test and first-timer UX audit: design

Date: 2026-11-10
Status: approved by owner 2026-11-10

## What this is, and why

Bench Book v1 (0.1.0) works and is tested piece by piece. Two things are missing:

1. **A full-game test that guards every release.** A scripted browser run of a whole game
   played by someone who knows the app, checking that every number on screen and in both
   CSVs is right. It answers "did this version break anything a scorer relies on?"
2. **A first-timer UX audit.** An AI agent plays someone who knows what keeping the book
   means, and knows what is tracked (points, fouls, timeouts), but has **never seen this
   app**. It tries to get through a game from what's on screen alone. It then writes a
   report of where it hesitated, guessed wrong or got stuck, and where help text or
   clearer wording would help. It answers "will the next volunteer handed this phone
   manage?"

The owner reads the audit report and decides what to change. The audit never edits the
app.

## Cadence (owner)

- **Full-game test: on every version bump** (0.1 → 0.2 …).
- **UX audit: on demand, at the bigger milestones** (e.g. 0.1, then 0.5, then 0.9/1.0).

## Versioning (owner-approved scheme)

Version numbers follow the product's phases. "v1" no longer names the current build: the
phases are **Phase 1/2/3**, and "v1.0" only ever means a version number.

| Version | Means | When |
|---|---|---|
| **0.x** (now 0.1.0) | Phase 1 (book companion), still being proven | each batch of fixes from field tests or audits is a **minor** bump (0.2, 0.3…); a quick bug fix is a **patch** (0.2.1) |
| **1.0** | Phase 1 trusted: used at real games beside the paper book without surprises | when the owner says it held up |
| **2.0** | Phase 2: update the book after each quarter, from the app | major bump when it lands |
| **3.0** | Phase 3: the app replaces the book | major bump |
| 1.x / 2.x minors | features within a phase (rule sets, more stats…) | as they land |

**Who manages it:** Claude does. Claude bumps the version and updates the changelog as part
of finishing work. The owner only declares milestones ("this is 1.0").

**Where the rules live:** a root `CLAUDE.md` in `bench-book`, which Claude Code loads in
every session. It states:
- that Claude owns versioning, and the scheme above;
- that every release goes through `pnpm release`, never a hand-edited version;
- that `CHANGELOG.md` (Keep a Changelog style, US English) gets an `Unreleased` entry as
  user-visible work lands, and that `pnpm release` moves those entries under the new
  version;
- the cadence of the release test and the UX audit.

`CHANGELOG.md` starts with a 0.1.0 entry summarizing Phase 1 as built.

## Part 1: the full-game release test

### Scenario

One fixed, deterministic game in `e2e/full-game.spec.ts`, driven the way a fluent user
would drive it. It runs at the iPhone 13 size, like the existing e2e test. It must cover:

- **Setup:** roster of 7 with invented names, including jersey numbers `0` and `00`.
  Opponent taps turned **on**.
- **Scoring:** 2s, 3s, made and missed free throws (with the sheet staying open for the
  pair), and opponent taps.
- **Fouls:**
  - one quarter reaches the bonus at our 5th team foul;
  - the count resets the next quarter;
  - one player fouls out on 5 fouls, another on 2 technicals;
  - a bench technical counts as a team foul.
- **Timeouts:** a full, a 30-second, and an OT timeout.
- **Fixes:**
  - one mis-tap undone;
  - one wrong entry edited in the Log;
  - one missed play inserted before a later play;
  - one missed "End Q" repaired with "Move this and everything after".
- **Checks against the book,** with one quarter each:
  - matches;
  - is off, then fixed in the inline log (reads **fixed**);
  - is off and left with a note (**noted**);
  - left unchecked (**pending**).
- **Overtime:** Q4 ends tied, one OT is played, and the OT foul count continues Q4's.
- **End and export:** End game, then export both CSVs.

### What it asserts

- **On screen, at chosen moments:** the score, the period label, team fouls and the bonus
  flag, timeouts left, the foul state of the affected players, the reconcile banner, and
  the open-issues list.
- **In the downloaded CSVs:** both files are parsed and specific cells are compared with
  expected values.
- **The expected values are written into the test by hand**, worked out from the scenario.
  The test must never compute them with the app's own `src/core` functions, because then
  it could not fail when that logic breaks.
- **No horizontal overflow** on any screen visited.

**How the app behaves here** (from v1; the builder should read `src/ui/` for exact names):
- Exports are two buttons on the End view, **Book CSV** and **Plays CSV**. Each is a real
  browser download (a Blob with `<a download>`), so use Playwright's `download` event and
  parse the file.
- The check against the book is **per quarter**. The scorer types our points for that
  quarter and the opponent's from the book's Score by Qtr box, and the app compares them
  with that quarter's events.
- The statuses show as chips on the Log's period headers (Matched / Fixed / Noted /
  Mismatch / Not checked) and in the Book CSV's `Reconcile` block, in its `Status` column
  (`matched`, `fixed`, `noted`, `unresolved`, `pending`).

**One test with `test.step`s** is fine. The scenario is one continuous game. *(My call.)*

### The release command

`pnpm release <patch|minor|major>`, a script run by hand (the owner prefers opt-in checks
to git hooks). In order, it:

1. refuses to run if the working tree isn't clean;
2. runs `pnpm check` and `pnpm test:e2e` (which includes the full-game test), and stops on
   any failure;
3. bumps `package.json` `version`;
4. moves `CHANGELOG.md`'s `Unreleased` entries under `## [X.Y.Z] - YYYY-MM-DD`, and refuses
   if `Unreleased` is empty;
5. commits `Release vX.Y.Z` and tags `vX.Y.Z`;
6. prints the push command but **does not push**. Pushing triggers a Netlify deploy, so
   the owner pushes.

It also refuses when not on `master`, or when the tag already exists. *(My call.)*

The **app shows its version** in small text on the Setup screen (e.g. `v0.2.0`). This lets
a report, a bug or an audit be tied to a version.

## Part 2: the first-timer UX audit

### How it's run

A Claude Code skill committed in the repo at `.claude/skills/ux-audit/`, invoked as
`/ux-audit` from inside `bench-book`. It:

1. builds the app and serves it with `astro preview --ignore-lock` on its own port, using a
   fresh browser profile for each run, so no service worker or saved game carries over;
2. hands the audit to a **fresh subagent** that plays the persona and drives a real
   phone-sized browser;
3. writes the report.

The repo is public, and a committed skill is fine there.

### The persona

Stored at `docs/ux-audit/personas/bookkeeper.md`, so it can be refined and so later
personas can sit beside it. The persona:

- knows what keeping the book at a game means, and knows the stats (points, fouls, team
  fouls, timeouts, free throws, bonus);
- has **never seen this app, and has no help from anyone**;
- is at a real game, under some time pressure, using one thumb.

**Later persona, recorded and not built now:** "knows basketball, kind of, that's it".

### The rules that make it a real first-timer

These are binding. The audit is worthless without them.

- **The persona agent must not read the app's source, docs, spec, plan, README or tests.**
  It sees only what a user sees: the rendered screens. Screenshots and the accessibility
  tree are both allowed. It gets no list of button names.
- **It gets the game as plain events, not instructions.** For example: "Your #4 makes a
  layup", "The ref calls a foul on #12; the scorer's table says that's his fourth",
  "Timeout, your coach, full", "The quarter ends; your book says 14–9", "You realize you
  missed a basket by #7 two plays ago". It is never told which button to press.
- **It narrates as it goes:** what it expected, what it tried, what happened, and whether
  it is unsure. Hesitation counts as a finding even when it eventually succeeds.
- **When it is stuck,** it records that and moves to the next event. It may say what it
  would have done next, but it must not open the code to find out.

**How these rules are enforced** *(my call)*:
- The persona runs as a dedicated agent definition (`.claude/agents/ux-persona.md`) with
  its tools limited to Bash. Its working directory is a temp folder **outside the repo**
  that holds only the driver script and its output.
- Its only interface is the driver: `node driver.mjs <action>`. The actions are tap by
  visible text, type into a field by its label, read the screen and screenshot. Each
  action returns the visible text, the accessibility tree and a screenshot path.
- Its prompt forbids reading anything else, and the controller checks the persona's
  command log afterwards. Any command other than the driver voids that run.
- Seeing button names in the accessibility tree is fine: that is what's on screen. The
  thing forbidden is a cheat sheet handed over in advance (a list of buttons or steps).

**Catching wrong entries the persona didn't notice** *(my call)*: `scenario.md` ends with
the **expected end state**, meaning the final score per quarter, each player's points and
fouls, and the timeouts used. After the run, the controller exports the CSVs through the
driver and compares them with that state. Each difference becomes a **wrong entry**
finding, even if the persona never noticed it. The completed / hesitated / failed counts
come from the persona's narration, checked against this comparison.

### The event script

The audit plays **all four quarters**, with events spread thinly (about 40 in total), plus the
end and export. Late-game behavior matters: End Q4 (Start OT or End game), a third
quarterly foul reset, and the post-game screens. *(Owner, 2026-11-10.)* It must still hit the features a newcomer is most likely to
fumble:

- starting a game;
- free throws;
- a foul-out;
- a timeout;
- undoing a mis-tap;
- fixing an earlier entry;
- ending a quarter;
- checking against the book (once matching, once not);
- ending the game;
- exporting.

The event list lives in `docs/ux-audit/scenario.md`, written as game events.

### The report

The report is written to `docs/ux-audit/reports/vX.Y.Z.md`, where X.Y.Z is `package.json`'s
version, the same number Setup shows. A second run on the same version appends `-2`. It contains:

- **Summary:** the version, the date, the persona, how many events were completed /
  hesitated on / failed, and the top 3 problems.
- **Findings,** one per issue:
  - the screen;
  - the game event being attempted;
  - what the persona expected;
  - what it did;
  - what happened;
  - a severity: **blocked** (couldn't do it), **wrong entry** (did the wrong thing without
    noticing), **hesitated** (got there, unsure) or **polish**;
  - a **suggested direction**, e.g. "label the ✗ as 'Missed'" or "explain what 'Check'
    does". This is a suggestion only; the owner decides the wording.
  - a screenshot reference, where it helps.
- **Compared with the last audit** (when one exists): which earlier findings are gone,
  which remain, and which are new.
- **Screenshots** go in `docs/ux-audit/reports/vX.Y.Z/`. Keep only the ones a finding
  points to. They contain only invented names.

The **controller session** (not the persona) writes the report's comparison section,
because that needs the previous report, which the persona must not see beforehand.

## Goals

- A version bump can't ship with a broken score, foul, timeout, reconcile or export path.
- The owner gets a readable, dated list of where a first-timer struggles, and can track it
  across versions.

## Non-goals

- The audit does not change the app, propose code, or open PRs.
- No CI service. Everything runs locally on demand.
- No visual-regression or screenshot-diff testing.
- No second persona yet.
- **Backlog (after 1.0):** run the release test a second time at tablet size.

## Anti-goals

- **An audit that "knows" the app.** If the persona can see source or button names, it
  reports nothing useful. That is the failure to guard against.
- **A release test that can't fail:** expected values derived from the code under test.
- **A release script that pushes or deploys by itself.**
- **Real roster names** in any fixture, scenario, report or screenshot. The repo is public.

## Decisions

| Decision | Choice | By |
|---|---|---|
| Release test cadence | every version bump | owner |
| Audit cadence | on demand, bigger milestones | owner |
| Audit output | a written report the owner reads and decides on; no edits | owner |
| Audit persona (now) | knows bookkeeping and the stats, never seen the app | owner |
| Release gate | `pnpm release` script, not a git hook; doesn't push | my call (owner prefers opt-in checks; a push deploys) |
| Version visible in app | small text on Setup | my call (ties reports to versions) |
| Audit mechanism | an in-repo Claude Code skill plus a fresh persona subagent driving the repo's Playwright Chromium | my call |
| Browser for the audit | the repo's installed Playwright Chromium. The Playwright MCP server here expects Google Chrome, which isn't installed. | my call |

## Left to the builder

- How the persona agent drives the browser: small Playwright scripts it writes and runs
  step by step, or a tiny driver script that takes one action, saves a screenshot and the
  accessibility tree, and returns them. The driver script is preferred: it keeps the
  persona from writing code against the app's internals, and it makes the rule above
  enforceable.
- Exact wording of the persona and scenario files, within the rules above.
- How `pnpm release` is implemented (a small Node script is fine).
