# Bench Book: project instructions

Process rules for working in this repo. For what the app is, see `README.md`.

## Versions and phases

The product is built in phases, called **Phase 1/2/3**. Version numbers follow them.
"v1" does not name the current build; "1.0" only ever means a version number.

| Version | Means | When |
|---|---|---|
| **0.x** | Phase 1 (book companion), still being proven | a batch of fixes or features is a **minor** bump (0.2, 0.3...); a single bug fix is a **patch** (0.2.1) |
| **1.0** | Phase 1 trusted: used at real games beside the paper book without surprises | when the owner says it held up |
| **2.0** | Phase 2: update the book after each quarter, from the app | major bump when it lands |
| **3.0** | Phase 3: the app replaces the book | major bump |
| 1.x / 2.x minors | features within a phase | as they land |

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

## Style

- US English in all prose, comments and commit messages.
- Commit messages carry no Claude or Anthropic attribution trailer.
- Test data uses invented names only. The repo is public.
