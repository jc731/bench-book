# Bench Book

A free, open-source web app for the person keeping the scorebook at a junior high
basketball game. Tap in your team's points, fouls and timeouts as they happen, reconcile
against the paper book at the end of each quarter, and export CSVs that pair with the book
page after the game.

- No login, no server. Everything stays on your device.
- Works offline once loaded. On iPhone/iPad, use **Add to Home Screen**.
- Rules: IESA / NFHS (team fouls reset each quarter, bonus on the 5th).

## How a game works

1. **Setup.** Enter the opponent, pick Home or Away, and enter your roster (name and number), then tap **Start game**.
   **Game details** holds the date, your team name, the coach, scorer and timekeeper, and the
   switch that also keeps the opponent's score. The roster is saved on the device for next time.
2. **Live.** Tap a player card, then `+2`, `+3`, `FT made`, `FT missed`, `Foul` or `Tech foul`.
   Bench technicals are on the **Bench** card after the players. Timeout, **Undo**, **Log** and
   **End Q** are on the bottom bar. One line above the bar shows what was just entered and stays
   until the next entry, with a chip at its right for a quarter still to check.
3. **Fix mistakes.** Undo right away, or open **Log** and tap a row: it opens the fix, where
   you change the play, the player or the quarter, or delete it.
4. **Check each quarter.** **End Q1** advances at once. When there is time, tap the check chip,
   enter the book's points for the quarter and see whether the app matches. You can leave it
   for later.
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
pnpm test:e2e   # scripted game in a real browser (Playwright, iPhone 13 profile)
pnpm check      # the gate: astro check, tsc, unit tests
pnpm howto:shots # refresh the How-to screenshots in public/howto/ (pnpm release runs it)
```

The first `pnpm test:e2e` run needs the browser once: `pnpm exec playwright install chromium`.

## Releases

Changes are listed in [`CHANGELOG.md`](CHANGELOG.md). A release is cut with
`pnpm release <patch|minor|major>`, which never pushes.

## Backlog

- Tablet-size release test (after 1.0)

## Deploy

Connect the repo in Netlify (build `pnpm build`, publish `dist`).

Design: [`docs/superpowers/specs/2026-11-10-bench-book-v1-design.md`](docs/superpowers/specs/2026-11-10-bench-book-v1-design.md).

Licensed under [MIT](LICENSE).
