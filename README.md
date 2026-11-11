# Bench Book

A free, open-source web app for the person keeping the scorebook at a junior high
basketball game. Tap in your team's points, fouls and timeouts as they happen, reconcile
against the paper book at the end of each quarter, and export CSVs that pair with the book
page after the game.

- No login, no server. Everything stays on your device.
- Works offline once loaded. On iPhone/iPad, use **Add to Home Screen**.
- Rules: IESA / NFHS (team fouls reset each quarter, bonus on the 5th).

## How a game works

1. **Setup.** Enter the opponent, the date and your roster (position, name, number), then
   tap **Start game**. The roster is saved on the device for next time.
2. **Live.** Tap a player card, then `+2`, `+3`, `FT ✓`, `FT ✗`, `Foul` or `Tech`. Timeouts,
   bench technicals and **Undo** are on the bottom bar. Every entry shows a toast you can undo.
3. **Check each quarter.** **End Q1** advances at once. When there is time, tap the banner,
   enter the book's points for the quarter and see whether the app matches. You can leave it
   for later.
4. **End.** After Q4, choose Start OT or End game. Any quarter not yet checked is listed.
5. **Export.** Download the Book CSV (pairs with the paper book page) and the Plays CSV
   (every entry, in order).

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
