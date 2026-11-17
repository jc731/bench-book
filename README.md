# Bench Book

A free, open-source web app for the person keeping the scorebook at a junior high
basketball game. Tap in your team's points, fouls and timeouts as they happen, reconcile
against the paper book at the end of each quarter, and export CSVs that pair with the book
page after the game.

- No login, no server. Everything stays on your device.
- Works offline once loaded. On iPhone/iPad, use **Add to Home Screen**.
- Rules: IESA / NFHS (team fouls reset each quarter, bonus on the 5th).

## How a game works

1. **Setup.** Pick Home or Away and enter your roster (name and number), then tap **Start game**.
   **Game details** holds the opponent (left blank, the game is named for its date, MM-DD), the
   date, your team name, the coach, scorer and timekeeper, and the switch that also keeps the
   opponent's score. The roster is saved on the device for next time.
2. **Live.** Tap a player card, then `+2`, `+3`, `FT made`, `FT missed`, `Foul` or `Tech foul`.
   Bench technicals are on the **Bench** card after the players. Timeout, **Undo**, **Log** and
   **End Q** are on the bottom bar. One line above the bar shows what was just entered and stays
   until the next entry, with a chip at its right for a quarter still to check.
3. **Fix mistakes.** Undo right away (Redo puts back one undone too many), or open **Log** and
   tap a row: it opens the fix, where you change the play, the player or the quarter, or delete it.
4. **Check each quarter.** **End Q1** advances at once. When there is time, tap the check chip,
   enter the game score after the quarter from the book's running score, and the app checks the
   quarter's own points against its plays. You can leave it for later.
5. **Final.** After Q4, choose Start overtime or End game (no overtime). The **Final** screen
   lists any quarter not yet checked, ends a game early with a confirm, and **Reopen game** puts
   an ended game back in play.
6. **Export.** From Final, download the Book CSV (pairs with the paper book page) and the Plays
   CSV (every entry, in order).

**How to use**, under the ⋯ button, explains all of this in the app, with screenshots.

Rules: IESA / NFHS. Game data is purged 72 hours after the last change; the saved roster is kept.

## Privacy

Nothing leaves the device. There is no server, no account, no analytics and no third-party
scripts or fonts. Roster names and game data live in the browser's local storage only.

## Development

```bash
pnpm install
pnpm dev        # dev server
pnpm build      # static build to dist/
pnpm preview    # serve the built site
pnpm test       # unit tests (vitest)
pnpm test:e2e   # scripted games in a real browser (Playwright, iPhone 13 profile); the bonus game prints taps per quarter
pnpm check      # the gate: astro check, tsc, unit tests
pnpm howto:shots # refresh the How-to screenshots in public/howto/ (pnpm release runs it)
```

The first `pnpm test:e2e` run needs the browser once: `pnpm exec playwright install chromium`.

## Colors

Each color has one job, so a color on screen says what kind of thing it is. Keep to these
when adding to the interface:

| Color | Means | Examples |
|---|---|---|
| **Amber** | Caution: something to look at, never "tap here" | a player at 4 fouls, the bonus, team fouls near the bonus, bench techs, a check that doesn't match, a file not saved yet, Not saving |
| **Red** | Out, or ends something for good | an out player, End Q4 / OT (can end the game), Discard when the game is not exported |
| **Blue** (`sky`) | The action to take, links, selection, focus | End Q1–Q3, Check, Undo, Redo, Home/Away chosen, focused fields |
| **White fill** | The main button of a screen or sheet | Start game, Save, Done, Book CSV, Plays CSV |
| **Green** | Done and fine | Matched, Fixed, saved files |
| **Gray** (`slate`) | Everything else: data, ordinary buttons, neutral state | the cards, a player's first three fouls, the bar |

Home cards are light (white) and Away cards dark, so the state colors have two sets of shades,
each kept at 3:1 or better for borders and dots and 4.5:1 for text:

| Card | Warn (4 fouls, bench tech) | Out | Warn text |
|---|---|---|---|
| Dark (away) | amber-400 border and dots | red-500 border and dots, red-400 OUT | amber-300 |
| Light (home) cards | amber-600 border and dots (bench card amber-700), slate-900 text | red-600 border, dots and OUT | amber-800 |

A status shown on a button (the amber check chip for a quarter that doesn't match) is still a
state color: the color says what is true, and the button shape says it can be tapped.

## Releases

Changes are listed in [`CHANGELOG.md`](CHANGELOG.md). A release is cut with
`pnpm release <patch|minor|major>`, which never pushes.

## Backlog

**For 1.0** (the checklist in `CLAUDE.md`): keeping both teams. Most scorers do: at the
owner's games, each team's scorer keeps both teams.

- Opponent team stats on the live screen: their fouls (and so our bonus), their timeouts,
  their points by player number. Team-level stats first (0.6/0.7), then the opponent roster.
- Active lineup with substitutions: the live screen shows only who is on the floor, and a
  fouled-out player prompts a sub. This is also the fix for large rosters: since 0.8 each team
  has half the screen, and an iPhone 13 fits 10 players (64 px cards, 506 px half with + Play,
  Bench and timeouts, no slack); 11 or more scroll inside their half (design audit v0.5.0, D1).
- Both teams in the Book CSV, and the quarter check compares both scores.

**After 1.0 (1.x):**

- Cross-scorer check at halftime and end of game: compare what you recorded with the other
  team's scorer and talk through any difference.
- Tablet-size release test.

## Deploy

Connect the repo in Netlify (build `pnpm build`, publish `dist`).

Design: [`docs/superpowers/specs/2026-11-10-bench-book-v1-design.md`](docs/superpowers/specs/2026-11-10-bench-book-v1-design.md).

Licensed under [MIT](LICENSE).
