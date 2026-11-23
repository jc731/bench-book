# Bench Book: project instructions

Process rules for working in this repo. For what the app is, see `README.md`.

## Versions and phases

The product is built in phases, called **Phase 1/2/3**. Version numbers follow them.
"v1" does not name the current build; "1.0" only ever means a version number.

| Version | Means | When |
|---|---|---|
| **0.x** | Phase 1 (book companion), on the way to the 1.0 checklist | a batch of fixes or features is a **minor** bump (0.2, 0.3...); a single bug fix is a **patch** (0.2.1) |
| **1.0** | Phase 1 for any scorer: a scorer who keeps both teams can use it beside the paper book | when every item on the checklist below is done |
| **2.0** | Phase 2: update the book after each quarter, from the app | major bump when it lands |
| **3.0** | Phase 3: the app replaces the book | major bump |
| 1.x / 2.x minors | features within a phase | as they land |

### The 1.0 checklist

Redefined 2026-11-16. The old 1.0 ("trusted for the owner's own team") was met at a real game on
0.4, so it no longer marked anything. The list is fixed: anything not on it goes to 1.x.

- [x] Opponent team stats on the live screen: their fouls (and our bonus), their timeouts, their
      points by player number. (0.8)
- [x] Active lineup with substitutions: the five on the floor sit at the top of their half,
      the bench below; a sub moves players between floor and bench, and nothing is ever hidden, so
      subbing is optional. A foul-out takes the player off the floor and tells the scorer to tell
      the official. Reworded 2026-11-16 (owner): the old wording, "shows only the players on the
      floor", is dropped. Reworded 2026-11-19: "prompts a sub" became the foul-out line, since 0.10's
      neutral cards drop the amber Sub prompt. (0.9)
- [x] Both teams in the Book CSV, and the quarter check compares both scores. (0.8)
- [x] A player stats page: each player's points and fouls by quarter, for both teams, where a
      play can be added or fixed for a given quarter, mid-game or at the quarter's end. Added
      2026-11-18 (owner), after the first real game on 0.9. Later stats (rebounds, assists) would
      live here, but they stay out of scope for 1.0. (0.11)
- [x] Edit teams mid-game from the More menu: names and both rosters, without recording a play.
      Added 2026-11-19 (owner), after a game where the rosters were built through Whose number?. (0.10)
- [x] A usage counter (taps and fixes per game, a Usage CSV) and neutral cards. Added 2026-11-19
      (owner). (0.10)
- [x] An Experiments page with an opt-in timeout clock (off by default). Added 2026-11-19 (owner). (0.10)
- [x] The How-to covers both-team scoring (done in 0.8), and `/ux-audit` finishes a scripted
      both-team game with nothing blocking (audit v0.11.0, 2026-11-20: 0 wrong entries, nothing
      blocking).
- [ ] Used at 3 or more real games on the release candidate, at least one tracking both teams,
      with no lost data and no hand-fixed CSV.
- Out of scope for 1.0: missed shots, rebounds, assists, configurable rule sets, the cross-scorer
  check (1.x), and anything from Phase 2.

## Claude owns versioning

- When user-visible work lands, add a bullet under `## [Unreleased]` in `CHANGELOG.md`.
  Keep the headings exactly `## [Unreleased]` and `## [X.Y.Z] - YYYY-MM-DD`, and every
  entry a `- ` bullet. A release script parses them.
- When a batch is done, release with `pnpm release <patch|minor|major>`. Never hand-edit
  `version` in `package.json`.
- Minor for a batch of fixes or features, patch for a single bug fix, major only when the
  owner declares a phase milestone.
- `CHANGELOG.md` follows Keep a Changelog, in US English. `pnpm release` moves the
  Unreleased bullets under `## [X.Y.Z] - YYYY-MM-DD`, and the full-game release test runs
  on every release (via `pnpm release`).
- `pnpm release` runs the full-game test and never pushes. Pushing deploys to Netlify, so
  do not push without the owner's go-ahead.

## UX audit cadence

Run the first-time-user audit at 0.1, around 0.5, at 1.0, and then for each new phase. It
runs as `/ux-audit`.

## Commands

- `pnpm check`: the per-commit gate (astro check, tsc, unit tests).
- `pnpm test:e2e`: the scripted game in a real browser. Run it for any change to `e2e/` or
  the interface.
- `pnpm release <patch|minor|major>`: cut a release.
- `pnpm howto:shots`: refreshes the How-to screenshots, `public/howto/*.png`, from the
  full-game fixture. `pnpm release` runs it and commits the images, so they stay current.
  An image made by hand gets a new filename and is referenced from `src/ui/howto-content.ts`;
  the script writes only its own four filenames, so a release never overwrites it. A
  hand-made image also needs the screenshot map in `src/ui/howto-content.test.ts` updated.

## Style

- Colors have one job each (amber caution, red out, blue action, white main button, green done,
  gray the rest). The table is in `README.md` § Colors: follow it, and update it with any change.
- US English in all prose, comments and commit messages.
- Commit messages carry no Claude or Anthropic attribution trailer.
- Test data uses invented names only. The repo is public.
